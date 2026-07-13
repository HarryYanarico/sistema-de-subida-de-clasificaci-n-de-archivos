import re
import io
import fitz
from django.http import JsonResponse, HttpResponse, Http404
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from apps.personas.models import Persona
from apps.documentos.models import Documento
from apps.storage.pdf_processor import PDFProcessor
from apps.storage.services import MinIOService


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

            for pdf_file in files:
                file_content = pdf_file.read()
                results = processor.process_pdf(persona.codigo, pdf_file.name, file_content)

                for result in results:
                    Documento.objects.create(
                        persona=persona,
                        tipo_documento=result['tipo_documento'],
                        archivo_original=result['archivo_original'],
                        archivo_pagina=result['archivo_pagina'],
                        pagina_numero=result['pagina_numero'],
                        texto_extraido=result['texto_extraido'],
                        estado='clasificado' if result['tipo_documento'] else 'pendiente',
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

            processor = PDFProcessor()
            procesados = 0
            total_paginas = 0
            errores = []
            detalles = []

            for pdf_file in files:
                filename = pdf_file.name
                codigo = filename.replace('.pdf', '').replace('.PDF', '').strip()

                if not re.match(r'^\d{8,9}$', codigo):
                    errores.append({
                        'archivo': filename,
                        'error': 'Nombre de archivo inválido. Se esperaba un código de 8-9 dígitos (ej: 12345678.pdf)',
                    })
                    continue

                persona = Persona.objects.filter(codigo=codigo).first()
                if not persona:
                    errores.append({
                        'archivo': filename,
                        'error': f'No se encontró persona con código {codigo}',
                    })
                    continue

                try:
                    file_content = pdf_file.read()
                    results = processor.process_pdf(persona.codigo, filename, file_content)

                    for result in results:
                        Documento.objects.create(
                            persona=persona,
                            tipo_documento=result['tipo_documento'],
                            archivo_original=result['archivo_original'],
                            archivo_pagina=result['archivo_pagina'],
                            pagina_numero=result['pagina_numero'],
                            texto_extraido=result['texto_extraido'],
                            estado='clasificado' if result['tipo_documento'] else 'pendiente',
                        )
                        total_paginas += 1

                    procesados += 1
                    detalles.append({
                        'archivo': filename,
                        'persona_id': persona.id,
                        'persona_codigo': persona.codigo,
                        'persona_nombre': f'{persona.nombres} {persona.apellidos}',
                        'paginas': len(results),
                    })
                except Exception as e:
                    errores.append({
                        'archivo': filename,
                        'error': f'Error al procesar: {str(e)}',
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


class DocumentoFileView(View):
    def get(self, request, doc_id):
        doc = Documento.objects.filter(id=doc_id).first()
        if not doc:
            raise Http404

        storage = MinIOService()
        pdf_bytes = storage.get_file(doc.archivo_pagina)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
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
        pdf_bytes = storage.get_file(doc.archivo_pagina)

        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = pdf_doc.load_page(0)

        mat = fitz.Matrix(0.5, 0.5)
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")

        pdf_doc.close()

        response = HttpResponse(png_bytes, content_type='image/png')
        response['Cache-Control'] = 'public, max-age=86400'
        response['X-Frame-Options'] = 'SAMEORIGIN'
        return response
