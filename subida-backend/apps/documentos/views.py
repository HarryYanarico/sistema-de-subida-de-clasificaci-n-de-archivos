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


def _parse_json_or_post(request):
    import json
    if request.content_type and 'application/json' in request.content_type:
        try:
            return json.loads(request.body.decode('utf-8') or '{}')
        except Exception:
            return {}
    return request.POST


@method_decorator(csrf_exempt, name='dispatch')
class AgruparLoteView(View):
    def post(self, request, lote_id):
        try:
            import os
            from .models import Lote, Pagina, Grupo, TipoDocumento
            from .agrupador import agrupar, comparar_con_tipos

            lote = Lote.objects.filter(id=lote_id).first()
            if not lote:
                return JsonResponse({'success': False, 'message': 'Lote no encontrado'}, status=404)

            paginas = list(Pagina.objects.filter(lote=lote, estado='pendiente'))
            if not paginas:
                return JsonResponse({'success': False, 'message': 'El lote no contiene páginas para agrupar'}, status=400)

            data = _parse_json_or_post(request)
            umbral_raw = data.get('umbral') or os.getenv('AGRUPADOR_UMBRAL', '0.38')
            try:
                umbral = float(umbral_raw)
            except (ValueError, TypeError):
                umbral = 0.38

            grupos_res = agrupar(paginas, umbral=umbral)
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
                    p.save(update_fields=['grupo', 'estado', 'firma_palabras', 'firma_estructura', 'descartable'])

            # RF-11: Páginas con texto vacío o < 10 caracteres (descartable=True) van al grupo especial "Descartadas"
            paginas_descartables = [p for p in paginas if getattr(p, 'descartable', False)]
            if paginas_descartables:
                grupo_desc, _ = Grupo.objects.get_or_create(
                    lote=lote,
                    estado='descartadas',
                    defaults={
                        'unidad': lote.unidad,
                        'firma_consolidada': {'tipo_especial': 'descartadas', 'palabras': []},
                        'total_paginas': 0,
                    },
                )
                for p in paginas_descartables:
                    p.grupo = grupo_desc
                    p.estado = 'descartada'
                    p.descartable = True
                    p.save(update_fields=['grupo', 'estado', 'descartable', 'firma_palabras', 'firma_estructura'])
                grupo_desc.total_paginas = grupo_desc.paginas.count()
                grupo_desc.save(update_fields=['total_paginas'])

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


@method_decorator(csrf_exempt, name='dispatch')
class DescartarPaginaLoteView(View):
    """RT-03: Mueve una página al grupo 'Descartadas' al final del lote sin borrar nada."""

    def post(self, request, lote_id):
        try:
            from django.db import transaction
            from .models import Lote, Pagina, Grupo, Documento

            data = _parse_json_or_post(request)
            pagina_id = data.get('pagina_id') or data.get('paginaId')
            if not pagina_id:
                return JsonResponse({'success': False, 'message': 'pagina_id es requerido'}, status=400)

            lote = Lote.objects.filter(id=lote_id).first()
            if not lote:
                return JsonResponse({'success': False, 'message': 'Lote no encontrado'}, status=404)

            pagina = Pagina.objects.filter(id=int(pagina_id), lote=lote).first()
            if not pagina:
                return JsonResponse({'success': False, 'message': 'Página no encontrada en este lote'}, status=404)

            with transaction.atomic():
                grupo_origen = pagina.grupo
                grupo_origen_id = grupo_origen.id if grupo_origen else None

                grupo_descartadas, _ = Grupo.objects.get_or_create(
                    lote=lote,
                    estado='descartadas',
                    defaults={
                        'unidad': lote.unidad,
                        'firma_consolidada': {'tipo_especial': 'descartadas', 'palabras': []},
                        'total_paginas': 0,
                    },
                )

                # Quitar la página de cualquier documento en borrador del grupo origen
                if grupo_origen and grupo_origen.id != grupo_descartadas.id:
                    for doc_borrador in Documento.objects.filter(grupo=grupo_origen, estado='pendiente'):
                        if doc_borrador.paginas.filter(id=pagina.id).exists():
                            pags_rest = [p for p in doc_borrador.get_paginas_ordenadas() if p.id != pagina.id]
                            if not pags_rest:
                                doc_borrador.delete()
                            else:
                                doc_borrador.es_doble_cara = len(pags_rest) == 2 and doc_borrador.es_doble_cara
                                doc_borrador.save(update_fields=['es_doble_cara'])
                                doc_borrador.set_paginas_ordenadas(pags_rest)

                pagina.grupo = grupo_descartadas
                pagina.descartable = True
                pagina.estado = 'descartada'
                pagina.save(update_fields=['grupo', 'descartable', 'estado'])

                grupo_descartadas.total_paginas = grupo_descartadas.paginas.count()
                grupo_descartadas.save(update_fields=['total_paginas'])

                if grupo_origen and grupo_origen.id != grupo_descartadas.id:
                    restantes = grupo_origen.paginas.count()
                    grupo_origen.total_paginas = restantes
                    if restantes == 0:
                        grupo_origen.estado = 'fusionado'
                        grupo_origen.save(update_fields=['total_paginas', 'estado'])
                    else:
                        grupo_origen.save(update_fields=['total_paginas'])

                # Limpiar gruposLocales obsoletos en borrador_agrupamiento si existían
                if isinstance(lote.borrador_agrupamiento, dict) and 'gruposLocales' in lote.borrador_agrupamiento:
                    borrador = dict(lote.borrador_agrupamiento)
                    borrador.pop('gruposLocales', None)
                    lote.borrador_agrupamiento = borrador

                lote.total_grupos = lote.grupos.exclude(estado__in=['fusionado', 'descartadas']).count()
                lote.save(update_fields=['total_grupos', 'borrador_agrupamiento'])

            return JsonResponse({
                'success': True,
                'pagina_id': pagina.id,
                'grupo_origen_id': grupo_origen_id,
                'grupo_descartadas_id': grupo_descartadas.id,
                'total_descartadas': grupo_descartadas.total_paginas,
                'total_grupos': lote.total_grupos,
            })
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class FusionarGruposLoteView(View):
    """RT-04: Fusiona uno o más grupos origen dentro de un grupo destino y marca los orígenes como 'fusionado'."""

    def post(self, request, lote_id):
        try:
            from django.db import transaction
            from .models import Lote, Pagina, Grupo, Documento
            from .agrupador import _construir_firma_consolidada

            data = _parse_json_or_post(request)
            destino_id = data.get('grupo_destino_id') or data.get('grupoDestinoId')
            origen_id = data.get('grupo_origen_id') or data.get('grupoOrigenId')
            origen_ids_raw = data.get('grupo_origen_ids') or data.get('grupoOrigenIds') or []

            if isinstance(origen_ids_raw, str):
                origen_ids = [int(x.strip()) for x in origen_ids_raw.split(',') if x.strip().isdigit()]
            elif isinstance(origen_ids_raw, list):
                origen_ids = [int(x) for x in origen_ids_raw if str(x).isdigit()]
            else:
                origen_ids = []

            if origen_id and int(origen_id) not in origen_ids:
                origen_ids.append(int(origen_id))

            if not destino_id or not origen_ids:
                return JsonResponse(
                    {'success': False, 'message': 'grupo_destino_id y grupo_origen_id(s) son requeridos'},
                    status=400,
                )

            destino_id = int(destino_id)
            origen_ids = [oid for oid in origen_ids if oid != destino_id]
            if not origen_ids:
                return JsonResponse(
                    {'success': False, 'message': 'El grupo origen y destino no pueden ser el mismo'},
                    status=400,
                )

            lote = Lote.objects.filter(id=lote_id).first()
            if not lote:
                return JsonResponse({'success': False, 'message': 'Lote no encontrado'}, status=404)

            grupo_destino = Grupo.objects.filter(id=destino_id, lote=lote).first()
            if not grupo_destino:
                return JsonResponse({'success': False, 'message': 'Grupo destino no encontrado'}, status=404)

            grupos_origen = list(Grupo.objects.filter(id__in=origen_ids, lote=lote))
            if not grupos_origen:
                return JsonResponse({'success': False, 'message': 'Grupos origen no encontrados'}, status=404)

            with transaction.atomic():
                # Emparejar por rol de página: Grupo destino = Página 1 (orden=1), cada Grupo origen = Página 2, 3... (orden=2, 3...)
                docs_destino = list(Documento.objects.filter(grupo=grupo_destino, estado='pendiente').order_by('id'))
                if not docs_destino:
                    for p_dest in grupo_destino.paginas.all().order_by('nro_pagina_en_pdf', 'id'):
                        d = Documento.objects.create(
                            unidad=lote.unidad,
                            lote=lote,
                            grupo=grupo_destino,
                            persona=getattr(lote, 'persona', None),
                            tipo_documento=grupo_destino.tipo_documento_sugerido,
                            estado='pendiente',
                            es_doble_cara=False,
                        )
                        d.set_paginas_ordenadas([p_dest])
                        docs_destino.append(d)

                for g_orig in grupos_origen:
                    # Eliminar borradores sueltos del grupo origen (sus páginas pasarán a ser Página 2, 3... de docs_destino)
                    Documento.objects.filter(grupo=g_orig, estado='pendiente').delete()
                    pags_orig = list(g_orig.paginas.all().order_by('nro_pagina_en_pdf', 'id'))
                    usados_docs = set()
                    pags_orig_usadas = set()

                    # 1. Emparejar primero con documentos que compartan el mismo pdf_origen
                    for p_orig in pags_orig:
                        if not p_orig.pdf_origen:
                            continue
                        for d_dest in docs_destino:
                            if d_dest.id in usados_docs:
                                continue
                            pags_d = d_dest.get_paginas_ordenadas()
                            if pags_d and pags_d[0].pdf_origen == p_orig.pdf_origen:
                                d_dest.set_paginas_ordenadas(pags_d + [p_orig])
                                usados_docs.add(d_dest.id)
                                pags_orig_usadas.add(p_orig.id)
                                break

                    # 2. Emparejar páginas restantes posicionalmente con los documentos de destino disponibles
                    docs_restantes = [d for d in docs_destino if d.id not in usados_docs]
                    pags_restantes = [p for p in pags_orig if p.id not in pags_orig_usadas]
                    for idx_p, p_orig in enumerate(pags_restantes):
                        if idx_p < len(docs_restantes):
                            d_dest = docs_restantes[idx_p]
                            pags_d = d_dest.get_paginas_ordenadas()
                            d_dest.set_paginas_ordenadas(pags_d + [p_orig])
                        else:
                            nuevo_doc = Documento.objects.create(
                                unidad=lote.unidad,
                                lote=lote,
                                grupo=grupo_destino,
                                persona=getattr(lote, 'persona', None),
                                tipo_documento=grupo_destino.tipo_documento_sugerido,
                                estado='pendiente',
                                es_doble_cara=False,
                            )
                            nuevo_doc.set_paginas_ordenadas([p_orig])
                            docs_destino.append(nuevo_doc)

                # Mover páginas de todos los grupos origen al grupo destino
                Pagina.objects.filter(grupo__in=grupos_origen, lote=lote).update(
                    grupo=grupo_destino,
                    estado='agrupada',
                    descartable=False,
                )

                # Marcar grupos origen como fusionados
                for g_orig in grupos_origen:
                    g_orig.estado = 'fusionado'
                    g_orig.total_paginas = 0
                    g_orig.save(update_fields=['estado', 'total_paginas'])

                pags_actualizadas = list(grupo_destino.paginas.all().order_by('nro_pagina_en_pdf', 'id'))
                grupo_destino.total_paginas = len(pags_actualizadas)
                if pags_actualizadas and grupo_destino.estado != 'descartadas':
                    grupo_destino.firma_consolidada = _construir_firma_consolidada(pags_actualizadas)
                grupo_destino.save(update_fields=['total_paginas', 'firma_consolidada'])

                if isinstance(lote.borrador_agrupamiento, dict) and 'gruposLocales' in lote.borrador_agrupamiento:
                    borrador = dict(lote.borrador_agrupamiento)
                    borrador.pop('gruposLocales', None)
                    lote.borrador_agrupamiento = borrador

                lote.total_grupos = lote.grupos.exclude(estado__in=['fusionado', 'descartadas']).count()
                lote.save(update_fields=['total_grupos', 'borrador_agrupamiento'])

            return JsonResponse({
                'success': True,
                'grupo_destino_id': grupo_destino.id,
                'grupos_fusionados': [g.id for g in grupos_origen],
                'total_paginas': grupo_destino.total_paginas,
                'total_grupos': lote.total_grupos,
            })
        except Exception as e:
            return JsonResponse({'success': False, 'message': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class EstructuraGrupoView(View):
    """RT-05 y RF-28: Persiste la estructura interna del grupo (secuencial, doble cara, mixta)
    directamente en las tablas `documentos` (`grupo_id`) y `documentos_paginas` (`orden`), sin usar JSON.
    """

    def post(self, request, grupo_id):
        try:
            from django.db import transaction
            from .models import Grupo, Pagina, Documento

            grupo = Grupo.objects.filter(id=grupo_id).select_related('lote', 'unidad').first()
            if not grupo:
                return JsonResponse({'success': False, 'message': 'Grupo no encontrado'}, status=404)

            data = _parse_json_or_post(request)
            documentos_input = data.get('documentos')
            modo = (data.get('modo') or '').lower()
            pagina_ids_raw = data.get('pagina_ids') or data.get('paginaIds')

            pags_en_grupo = {p.id: p for p in Pagina.objects.filter(lote=grupo.lote)}

            bloques_documentos = []
            if isinstance(documentos_input, list) and len(documentos_input) > 0:
                for item in documentos_input:
                    if not isinstance(item, dict):
                        continue
                    pids = [int(pid) for pid in (item.get('pagina_ids') or item.get('paginaIds') or []) if int(pid) in pags_en_grupo]
                    if not pids:
                        continue
                    es_doble = bool(item.get('es_doble_cara', item.get('esDobleCara', len(pids) == 2)))
                    bloques_documentos.append({
                        'paginas': [pags_en_grupo[pid] for pid in pids],
                        'es_doble_cara': es_doble,
                    })
            else:
                if isinstance(pagina_ids_raw, list) and pagina_ids_raw:
                    pids_ordenados = [int(pid) for pid in pagina_ids_raw if int(pid) in pags_en_grupo]
                    pags_ordenadas = [pags_en_grupo[pid] for pid in pids_ordenados]
                else:
                    pags_ordenadas = list(grupo.paginas.all().order_by('nro_pagina_en_pdf', 'id'))

                if modo in ('doble_cara', 'anverso_reverso'):
                    for i in range(0, len(pags_ordenadas), 2):
                        par = pags_ordenadas[i:i + 2]
                        bloques_documentos.append({
                            'paginas': par,
                            'es_doble_cara': len(par) == 2,
                        })
                elif modo == 'multipagina':
                    if pags_ordenadas:
                        bloques_documentos.append({
                            'paginas': pags_ordenadas,
                            'es_doble_cara': False,
                        })
                else:
                    # Secuencial: cada página es un documento simple
                    for p in pags_ordenadas:
                        bloques_documentos.append({
                            'paginas': [p],
                            'es_doble_cara': False,
                        })

            with transaction.atomic():
                # Asegurar que todas las páginas incluidas pertenezcan a este grupo
                todas_pags_ids = [p.id for b in bloques_documentos for p in b['paginas']]
                if todas_pags_ids:
                    Pagina.objects.filter(id__in=todas_pags_ids, lote=grupo.lote).update(grupo=grupo)
                    grupo.total_paginas = grupo.paginas.count()
                    grupo.save(update_fields=['total_paginas'])

                # Reemplazar borradores previos del grupo
                Documento.objects.filter(grupo=grupo, estado='pendiente').delete()

                docs_creados = []
                for idx_doc, bloque in enumerate(bloques_documentos, start=1):
                    pags_bloque = bloque['paginas']
                    primera = pags_bloque[0]
                    doc = Documento.objects.create(
                        unidad=grupo.unidad,
                        lote=grupo.lote,
                        grupo=grupo,
                        persona=getattr(grupo.lote, 'persona', None),
                        tipo_documento=grupo.tipo_documento_sugerido,
                        es_doble_cara=bloque['es_doble_cara'],
                        estado='pendiente',
                        nombre_final=f"Grupo {grupo.id} - Doc {idx_doc}",
                        archivo_original=primera.pdf_origen or '',
                        pagina_numero=primera.nro_pagina_en_pdf or 1,
                        texto_extraido='\n'.join(p.texto_ocr for p in pags_bloque if p.texto_ocr),
                        phash=primera.phash,
                    )
                    doc.set_paginas_ordenadas(pags_bloque)
                    docs_creados.append({
                        'id': doc.id,
                        'es_doble_cara': doc.es_doble_cara,
                        'pagina_ids': [p.id for p in pags_bloque],
                    })

            return JsonResponse({
                'success': True,
                'grupo_id': grupo.id,
                'total_documentos': len(docs_creados),
                'documentos': docs_creados,
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

        if doc.archivo_original and doc.archivo_original.startswith('lotes/'):
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'inline; filename="documento_{doc.id}.pdf"'
            response['X-Frame-Options'] = 'SAMEORIGIN'
            return response

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
        page_index = 0 if (doc.archivo_original and doc.archivo_original.startswith('lotes/')) else (doc.pagina_numero - 1)

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

