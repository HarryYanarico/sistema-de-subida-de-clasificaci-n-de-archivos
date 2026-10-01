import io
import fitz
from django.http import JsonResponse, HttpResponse, Http404
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from apps.personas.models import Persona
from apps.documentos.models import Documento, OrigenArchivos, Sincronizacion
from apps.unidades.models import Unidad
from apps.storage.ingesta import procesar_ingesta
from apps.storage.pdf_processor import PDFProcessor
from apps.storage.services import MinIOService
from apps.storage.sincronizacion import resultado_dict, sincronizar_origen

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

            persona = Persona.objects.filter(id=persona_id).first()
            if not persona:
                return JsonResponse({'success': False, 'message': 'Persona no encontrada'}, status=404)

            files = request.FILES.getlist('pdfs')
            if not files:
                return JsonResponse({'success': False, 'message': 'No se enviaron archivos'}, status=400)

            processor = PDFProcessor()
            total_pages = 0
            usuario = _get_user_from_request(request)

            for pdf_file in files:
                file_content = pdf_file.read()
                results = processor.process_pdf(persona.codigo, pdf_file.name, file_content, unidad=persona.unidad)

                for result in results:
                    Documento.objects.create(
                        persona=persona,
                        tipo_documento=result['tipo_documento'],
                        archivo_original=result['archivo_original'],
                        pagina_numero=result['pagina_numero'],
                        texto_extraido=result['texto_extraido'],
                        estado='clasificado' if result['tipo_documento'] else 'pendiente',
                        subido_por=usuario,
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
            unidad_id = request.POST.get('unidad_id')
            if not unidad_id:
                return JsonResponse({'success': False, 'message': 'unidad_id es requerido'}, status=400)

            unidad = Unidad.objects.filter(id=unidad_id).first()
            if not unidad:
                return JsonResponse({'success': False, 'message': 'Unidad no encontrada'}, status=404)

            files = request.FILES.getlist('pdfs')
            if not files:
                return JsonResponse({'success': False, 'message': 'No se enviaron archivos'}, status=400)

            processor = PDFProcessor()
            procesados = 0
            total_paginas = 0
            errores = []
            detalles = []

            usuario = _get_user_from_request(request)

            for pdf_file in files:
                ok, resultado = procesar_ingesta(
                    pdf_file.name, pdf_file.read(), unidad, usuario, processor=processor
                )

                if ok:
                    procesados += 1
                    total_paginas += resultado['paginas']
                    detalles.append(resultado)
                else:
                    errores.append({
                        'archivo': pdf_file.name,
                        'error': resultado['error'],
                    })

            return JsonResponse({
                'success': True,
                'total_archivos': len(files),
                'procesados': procesados,
                'total_paginas': total_paginas,
                'errores': errores,
                'detalles': detalles,
            })

        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


def _int_arg(request, name):
    valor = request.POST.get(name) or request.GET.get(name)
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        raise ValueError(f'{name} debe ser un número entero')


def _serializar_sincronizacion(sincronizacion):
    datos = resultado_dict(sincronizacion)
    datos['iniciada_en'] = (
        sincronizacion.iniciada_en.isoformat()
        if hasattr(sincronizacion, 'iniciada_en') else None
    )
    return datos


def _serializar_origen(origen):
    return {
        'id': origen.id,
        'unidad_id': origen.unidad_id,
        'unidad': origen.unidad.nombre,
        'tipo': origen.tipo,
        'identificador': origen.identificador,
        'drive_compartido': origen.drive_compartido,
        'activo': origen.activo,
        'marca_tiempo': origen.marca_tiempo.isoformat() if origen.marca_tiempo else None,
        'ultima_sincronizacion': (
            origen.ultima_sincronizacion.isoformat() if origen.ultima_sincronizacion else None
        ),
        'ultimo_error': origen.ultimo_error,
    }


@method_decorator(csrf_exempt, name='dispatch')
class SincronizacionView(View):
    def post(self, request):
        try:
            origen_id = _int_arg(request, 'origen_id')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        if not origen_id:
            return JsonResponse(
                {'success': False, 'message': 'origen_id es requerido'}, status=400
            )

        origen = OrigenArchivos.objects.filter(id=origen_id).select_related('unidad').first()
        if not origen:
            return JsonResponse({'success': False, 'message': 'Origen no encontrado'}, status=404)
        if not origen.activo:
            return JsonResponse(
                {'success': False, 'message': 'El origen está inactivo'}, status=400
            )

        try:
            limite = _int_arg(request, 'limit')
            dry_run = (request.POST.get('dry_run') or '').lower() in ('1', 'true', 'si', 'yes')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        usuario = _get_user_from_request(request)
        resultado = sincronizar_origen(
            origen, usuario=usuario, limite=limite, dry_run=dry_run
        )
        datos = _serializar_sincronizacion(resultado)
        fallida = datos['estado'] == 'fallida'

        origen.refresh_from_db()
        return JsonResponse({
            'success': not fallida,
            'origen': _serializar_origen(origen),
            'resultado': datos,
        }, status=502 if fallida else 200)


class SincronizacionHistorialView(View):
    def get(self, request):
        try:
            origen_id = _int_arg(request, 'origen_id')
            limite = _int_arg(request, 'limit') or 20
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)

        queryset = Sincronizacion.objects.select_related('origen__unidad')
        if origen_id:
            queryset = queryset.filter(origen_id=origen_id)

        return JsonResponse({
            'success': True,
            'resultados': [
                _serializar_sincronizacion(s) for s in queryset[:limite]
            ],
        })


class OrigenArchivosListView(View):
    def get(self, request):
        origenes = OrigenArchivos.objects.select_related('unidad')
        try:
            unidad_id = _int_arg(request, 'unidad_id')
        except ValueError as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=400)
        if unidad_id:
            origenes = origenes.filter(unidad_id=unidad_id)

        return JsonResponse({
            'success': True,
            'origenes': [_serializar_origen(o) for o in origenes],
        })


class DocumentoFileView(View):
    def get(self, request, doc_id):
        doc = Documento.objects.filter(id=doc_id).first()
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
        doc = Documento.objects.filter(id=doc_id).first()
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
        doc = Documento.objects.filter(id=doc_id).first()
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
