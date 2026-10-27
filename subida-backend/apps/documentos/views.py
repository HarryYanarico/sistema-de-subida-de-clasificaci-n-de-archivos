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
from apps.storage.ingesta import procesar_ingesta, procesar_ingesta_lote, procesar_ingesta_lote_multiple
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
            unidad = getattr(request, 'unidad', None)
            usuario = request.user if getattr(request, 'user', None) and request.user.is_authenticated else _get_user_from_request(request)

            archivos = [(f.name, f.read()) for f in files]
            ok, resultado = procesar_ingesta_lote_multiple(
                archivos, usuario, unidad=unidad, persona_id=persona_id
            )

            if not ok:
                return JsonResponse({'success': False, 'message': resultado.get('error', 'Error al procesar lote')}, status=400)

            return JsonResponse({
                'success': True,
                'total_archivos': len(files),
                'procesados': len(files),
                'total_paginas': resultado.get('total_paginas', 0),
                'total_grupos': resultado.get('total_grupos', 0),
                'lote_id': resultado.get('lote_id'),
                'detalles': [resultado],
                'errores': [],
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class IniciarLoteView(View):
    def post(self, request):
        try:
            from apps.personas.models import Persona
            persona_id = request.POST.get('persona_id')
            persona = Persona.objects.filter(id=persona_id).first() if persona_id else None
            unidad = getattr(request, 'unidad', None)
            usuario = request.user if getattr(request, 'user', None) and request.user.is_authenticated else _get_user_from_request(request)

            from .models import Lote
            lote = Lote.objects.create(
                unidad=unidad,
                subido_por=usuario,
                persona=persona,
                nombre_archivo_original="Lote en procesamiento",
                estado='procesando',
                total_paginas=0,
                total_grupos=0,
            )
            return JsonResponse({'success': True, 'lote_id': lote.id})
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class UploadLotePDFView(View):
    def post(self, request, lote_id):
        try:
            from .models import Lote, Pagina
            from apps.storage.services import MinIOService
            from apps.storage.pdf_processor import PDFProcessor
            from .agrupador import extraer_firma
            import fitz

            lote = Lote.objects.filter(id=lote_id).first()
            if not lote:
                return JsonResponse({'success': False, 'message': 'Lote no encontrado'}, status=404)

            archivo = request.FILES.get('pdf')
            if not archivo:
                return JsonResponse({'success': False, 'message': 'No se envió ningún PDF'}, status=400)

            contenido = archivo.read()
            storage = MinIOService()
            cod_folder = lote.persona.codigo if lote.persona else f"unidad_{getattr(lote.unidad, 'codigo', 'general')}"
            pdf_key = storage.upload_pdf(cod_folder, archivo.name, contenido)

            pdf_doc = fitz.open(stream=contenido, filetype="pdf")
            paginas_creadas = []
            for page_num in range(len(pdf_doc)):
                page = pdf_doc.load_page(page_num)
                text = page.get_text() or ""
                phash_val = PDFProcessor._calcular_phash(page)
                pag = Pagina(
                    unidad=lote.unidad,
                    lote=lote,
                    pdf_origen=pdf_key,
                    nro_pagina_en_pdf=page_num + 1,
                    texto_ocr=text,
                    phash=phash_val,
                    estado='pendiente',
                )
                extraer_firma(pag)
                pag.save()
                paginas_creadas.append(pag)
            pdf_doc.close()

            lote.total_paginas = (lote.total_paginas or 0) + len(paginas_creadas)
            if lote.nombre_archivo_original == "Lote en procesamiento":
                lote.nombre_archivo_original = archivo.name
            lote.save(update_fields=['total_paginas', 'nombre_archivo_original'])

            return JsonResponse({
                'success': True,
                'archivo': archivo.name,
                'paginas_en_pdf': len(paginas_creadas),
                'total_paginas_lote': lote.total_paginas,
            })
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class AgruparLoteView(View):
    def post(self, request, lote_id):
        try:
            from .models import Lote, Pagina, Grupo, TipoDocumento
            from .agrupador import agrupar, comparar_con_tipos

            lote = Lote.objects.filter(id=lote_id).first()
            if not lote:
                return JsonResponse({'success': False, 'message': 'Lote no encontrado'}, status=404)

            paginas = list(Pagina.objects.filter(lote=lote, estado='pendiente'))
            if not paginas:
                return JsonResponse({'success': False, 'message': 'El lote no contiene páginas para agrupar'}, status=400)

            grupos_res = agrupar(paginas)
            tipos_existentes = list(TipoDocumento.objects.filter(unidad=lote.unidad, activo=True)) if lote.unidad else list(TipoDocumento.objects.filter(activo=True))

            for gr in grupos_res:
                tipo_sugerido = comparar_con_tipos(gr, tipos_existentes)
                estado_grupo = 'coincide_con_tipo' if tipo_sugerido else 'nuevo'

                grupo_db = Grupo.objects.create(
                    unidad=lote.unidad,
                    lote=lote,
                    firma_consolidada=gr.firma_consolidada,
                    total_paginas=gr.total_paginas,
                    tipo_documento_sugerido=tipo_sugerido,
                    estado=estado_grupo,
                )

                for p in gr.paginas:
                    p.grupo = grupo_db
                    p.estado = 'agrupada'
                    p.save(update_fields=['grupo', 'estado'])

            lote.total_grupos = len(grupos_res)
            lote.estado = 'pendiente_nombres'
            lote.save(update_fields=['total_grupos', 'estado'])

            return JsonResponse({
                'success': True,
                'lote_id': lote.id,
                'total_paginas': lote.total_paginas,
                'total_grupos': lote.total_grupos,
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

