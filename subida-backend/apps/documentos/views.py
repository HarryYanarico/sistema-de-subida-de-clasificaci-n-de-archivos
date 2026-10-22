import io
import fitz
from django.http import JsonResponse, HttpResponse, Http404
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from apps.personas.models import Persona
from apps.documentos.models import Documento, Pagina
from apps.documentos.deduplicacion import buscar_duplicado
from apps.storage.clasificador import estado_desde_pagina
from apps.storage.ingesta import procesar_ingesta, procesar_ingesta_lote
from apps.storage.pdf_processor import PDFProcessor
from apps.storage.services import MinIOService

User = get_user_model()

def _get_user_from_request(request):
    user_id = request.POST.get('user_id') or request.GET.get('user_id')
    if user_id:
        try:
            return User.objects.filter(id=user_id).first()
        except (ValueError, TypeError):
            return None
    if request.user.is_authenticated:
        return request.user
    return None


@method_decorator(csrf_exempt, name='dispatch')
class UploadPDFView(View):
    def post(self, request):
        try:
            persona_id = request.POST.get('persona_id')
            if not persona_id:
                return JsonResponse({'success': False, 'message': 'persona_id es requerido'}, status=400)

            unidad = getattr(request, 'unidad', None)
            qs = Persona.objects.filter(id=persona_id)
            if unidad is not None:
                qs = qs.filter(unidad=unidad)
            persona = qs.first()
            if not persona:
                return JsonResponse({'success': False, 'message': 'Persona no encontrada'}, status=404)

            files = request.FILES.getlist('pdfs')
            if not files:
                return JsonResponse({'success': False, 'message': 'No se enviaron archivos'}, status=400)

            processor = PDFProcessor()
            total_pages = 0
            usuario = request.user if getattr(request, 'user', None) and request.user.is_authenticated else _get_user_from_request(request)
            doc_unidad = unidad or getattr(persona, 'unidad', None)

            for pdf_file in files:
                file_content = pdf_file.read()
                results = processor.process_pdf(
                    persona.codigo, pdf_file.name, file_content,
                    persona=persona, unidad=doc_unidad,
                )

                for result in results:
                    phash = result.get('phash')
                    original_id = buscar_duplicado(phash, unidad=doc_unidad) if phash else None
                    Documento.objects.create(
                        unidad=doc_unidad,
                        persona=persona,
                        tipo_documento=result['tipo_documento'],
                        archivo_original=result['archivo_original'],
                        pagina_numero=result['pagina_numero'],
                        texto_extraido=result['texto_extraido'],
                        estado=estado_desde_pagina(result, es_duplicado=original_id is not None),
                        score=result.get('score'),
                        keywords_matcheadas=result.get('keywords_matcheadas') or [],
                        subido_por=usuario,
                        phash=phash,
                        duplicado_de_id=original_id,
                    )
                    total_pages += 1

            return JsonResponse({
                'success': True,
                'message': f'Se procesaron {len(files)} PDF(s) con {total_pages} páginas',
                'total_pages': total_pages,
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class UploadBatchPDFView(View):
    def post(self, request):
        try:
            files = request.FILES.getlist('pdfs')
            if not files:
                return JsonResponse({'success': False, 'message': 'No se enviaron archivos'}, status=400)

            persona_id = request.POST.get('persona_id')
            procesados = 0
            total_paginas = 0
            errores = []
            detalles = []

            unidad = getattr(request, 'unidad', None)
            usuario = request.user if getattr(request, 'user', None) and request.user.is_authenticated else _get_user_from_request(request)

            for pdf_file in files:
                ok, resultado = procesar_ingesta_lote(
                    pdf_file.name, pdf_file.read(), usuario, unidad=unidad, persona_id=persona_id
                )

                if ok:
                    procesados += 1
                    total_paginas += resultado.get('total_paginas', resultado.get('paginas', 0))
                    detalles.append(resultado)
                else:
                    errores.append({
                        'archivo': pdf_file.name,
                        'error': resultado['error'],
                    })

            primer_lote_id = detalles[0].get('lote_id') if detalles else None

            return JsonResponse({
                'success': len(errores) == 0,
                'total_archivos': len(files),
                'procesados': procesados,
                'total_paginas': total_paginas,
                'lote_id': primer_lote_id,
                'errores': errores,
                'detalles': detalles,
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


class DocumentoFileView(View):
    def get(self, request, doc_id):
        unidad = getattr(request, 'unidad', None)
        qs = Documento.objects.filter(id=doc_id)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        doc = qs.first()
        if not doc:
            raise Http404

        storage = MinIOService()
        pdf_bytes = storage.get_file(doc.archivo_original)

        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_index = doc.pagina_numero - 1

        if page_index < 0 or page_index >= len(pdf_doc):
            pdf_doc.close()
            raise Http404

        pdf_page = fitz.open()
        pdf_page.insert_pdf(pdf_doc, from_page=page_index, to_page=page_index)
        page_bytes = pdf_page.tobytes()

        pdf_page.close()
        pdf_doc.close()

        response = HttpResponse(page_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="pagina_{doc.pagina_numero}.pdf"'
        response['X-Frame-Options'] = 'SAMEORIGIN'
        return response


class DocumentoOriginalView(View):
    def get(self, request, doc_id):
        unidad = getattr(request, 'unidad', None)
        qs = Documento.objects.filter(id=doc_id)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        doc = qs.first()
        if not doc:
            raise Http404

        storage = MinIOService()
        pdf_bytes = storage.get_file(doc.archivo_original)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        filename = doc.archivo_original.split('/')[-1]
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        response['X-Frame-Options'] = 'SAMEORIGIN'
        return response


class DocumentoThumbnailView(View):
    def get(self, request, doc_id):
        unidad = getattr(request, 'unidad', None)
        qs = Documento.objects.filter(id=doc_id)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        doc = qs.first()
        if not doc:
            raise Http404

        storage = MinIOService()
        pdf_bytes = storage.get_file(doc.archivo_original)

        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_index = doc.pagina_numero - 1

        if page_index < 0 or page_index >= len(pdf_doc):
            pdf_doc.close()
            raise Http404

        page = pdf_doc.load_page(page_index)

        mat = fitz.Matrix(0.5, 0.5)
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")

        pdf_doc.close()

        response = HttpResponse(png_bytes, content_type='image/png')
        response['Cache-Control'] = 'public, max-age=86400'
        response['X-Frame-Options'] = 'SAMEORIGIN'
        return response


class PaginaThumbnailView(View):
    def get(self, request, pagina_id):
        unidad = getattr(request, 'unidad', None)
        qs = Pagina.objects.filter(id=pagina_id)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        pagina = qs.first()
        if not pagina:
            raise Http404

        storage = MinIOService()
        try:
            pdf_bytes = storage.get_file(pagina.pdf_origen)
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_index = pagina.nro_pagina_en_pdf - 1

            if page_index < 0 or page_index >= len(pdf_doc):
                pdf_doc.close()
                raise Http404

            page = pdf_doc.load_page(page_index)
            mat = fitz.Matrix(0.5, 0.5)
            pix = page.get_pixmap(matrix=mat)
            png_bytes = pix.tobytes("png")
            pdf_doc.close()

            response = HttpResponse(png_bytes, content_type='image/png')
            response['Cache-Control'] = 'public, max-age=86400'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            return response
        except Exception:
            raise Http404


class PaginaFileView(View):
    """
    Retorna la página individual del PDF en formato PDF (inline) para visualización en navegador o iframe.
    """
    def get(self, request, pagina_id):
        unidad = getattr(request, 'unidad', None)
        qs = Pagina.objects.filter(id=pagina_id)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        pagina = qs.first()
        if not pagina:
            raise Http404

        storage = MinIOService()
        try:
            pdf_bytes = storage.get_file(pagina.pdf_origen)
            pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_index = pagina.nro_pagina_en_pdf - 1

            if page_index < 0 or page_index >= len(pdf_doc):
                pdf_doc.close()
                raise Http404

            pdf_page = fitz.open()
            pdf_page.insert_pdf(pdf_doc, from_page=page_index, to_page=page_index)
            page_bytes = pdf_page.tobytes()

            pdf_page.close()
            pdf_doc.close()

            response = HttpResponse(page_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="pagina_{pagina.nro_pagina_en_pdf}.pdf"'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            return response
        except Exception:
            raise Http404

