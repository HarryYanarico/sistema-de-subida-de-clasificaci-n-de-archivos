import re

from apps.documentos.deduplicacion import buscar_duplicado
from apps.documentos.models import Documento
from apps.personas.models import Persona
from apps.storage.clasificador import estado_desde_pagina
from apps.storage.pdf_processor import PDFProcessor

TAMANO_MAXIMO_PDF = 50 * 1024 * 1024

ERROR_NOMBRE_INVALIDO = (
    'Nombre de archivo inválido. No se pudieron extraer 4 o más dígitos '
    '(ej: 12345678.pdf, 216179920_JUAN_PEREZ.pdf o Documento_12345678.pdf)'
)


def extract_candidate_codes(filename: str) -> list:
    """
    Extrae bloques de 4 o más dígitos del nombre de archivo.
    Prioriza el primer bloque numérico (al inicio o tras prefijos comunes como 'Doc_', 'Exp_'),
    ignorando sufijos posteriores (años como 2024, tomos, etc.).
    """
    name = filename.rsplit('.', 1)[0].strip()

    candidatos = []

    # 1. Prioridad: bloque numérico de 4+ dígitos al inicio o con prefijo
    match_inicio = re.match(r'^(?:[A-Za-z]+[\s_\-\.]+)?(\d{4,})', name)
    if match_inicio:
        candidatos.append(match_inicio.group(1))

    # 2. Otros bloques numéricos de 4+ dígitos en el nombre (delimitados)
    for bloque in re.findall(r'\b\d{4,}\b', name):
        if bloque not in candidatos:
            candidatos.append(bloque)

    # 3. Fallback en caso de nombres sin delimitadores de palabra
    if not candidatos:
        for bloque in re.findall(r'\d{4,}', name):
            if bloque not in candidatos:
                candidatos.append(bloque)

    return candidatos


def extract_digits_from_filename(filename: str) -> str:
    """
    Retorna el código de registro candidato principal para compatibilidad.
    """
    candidatos = extract_candidate_codes(filename)
    return candidatos[0] if candidatos else ''


def resolver_persona(nombre: str, unidad=None) -> tuple:
    """
    Resuelve la persona correspondiente al archivo filtrando por su unidad.
    Principio: 'El regex propone, la tabla dispone'.
    Si hay múltiples números (ej: código y año 2024), valida contra la tabla Persona.
    """
    candidatos = extract_candidate_codes(nombre)
    if not candidatos:
        return None, None, ERROR_NOMBRE_INVALIDO

    persona = None
    codigo_seleccionado = candidatos[0]

    # Buscar cuál de los candidatos existe realmente en la base de datos para la unidad
    for cand in candidatos:
        qs = Persona.objects.filter(codigo=cand)
        if unidad is not None:
            qs = qs.filter(unidad=unidad)
        p = qs.first()
        if p:
            persona = p
            codigo_seleccionado = cand
            break

    if not persona:
        return None, codigo_seleccionado, f'No se encontró persona con código {codigo_seleccionado}'

    return persona, codigo_seleccionado, None


def procesar_ingesta(nombre, contenido, usuario, unidad=None, processor=None):
    if unidad is None and usuario is not None:
        unidad = getattr(usuario, 'unidad', None)

    persona, codigo, error_validacion = resolver_persona(nombre, unidad=unidad)

    if error_validacion:
        return False, {'error': error_validacion}

    if len(contenido) > TAMANO_MAXIMO_PDF:
        return False, {
            'error': f'Archivo demasiado grande ({len(contenido) // (1024 * 1024)} MB, '
                     f'máximo {TAMANO_MAXIMO_PDF // (1024 * 1024)} MB)'
        }

    doc_unidad = unidad or getattr(persona, 'unidad', None)

    if processor is None:
        processor = PDFProcessor()

    try:
        results = processor.process_pdf(
            persona.codigo, nombre, contenido, persona=persona, unidad=doc_unidad
        )

        paginas = 0
        duplicados = 0
        for result in results:
            phash = result.get('phash')
            # Se busca antes de crear: el duplicado es el que ya existe en la misma unidad
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
            paginas += 1
            if original_id:
                duplicados += 1

        return True, {
            'archivo': nombre,
            'persona_id': persona.id,
            'persona_codigo': persona.codigo,
            'persona_nombre': f'{persona.nombres} {persona.apellidos}',
            'paginas': paginas,
            'duplicados': duplicados,
        }
    except Exception as e:
        return False, {'error': f'Error al procesar: {str(e)}'}


def procesar_ingesta_lote(nombre, contenido, usuario, unidad=None, persona_id=None):
    """Procesa un único archivo PDF delegando en procesar_ingesta_lote_multiple."""
    return procesar_ingesta_lote_multiple([(nombre, contenido)], usuario, unidad=unidad, persona_id=persona_id)


def procesar_ingesta_lote_multiple(archivos: list[tuple[str, bytes]], usuario, unidad=None, persona_id=None):
    """
    Procesa múltiples archivos PDF en un único Lote contenedor:
    1. Valida el tamaño de cada archivo.
    2. Resuelve la unidad multi-tenant.
    3. Resuelve persona de forma flexible (si aplica).
    4. Sube cada PDF original a MinIO.
    5. Crea UN SOLO registro Lote contenedor para toda la tanda.
    6. Divide cada PDF en páginas (PyMuPDF) computando OCR y pHash.
    7. Agrupa TODAS las páginas de todos los PDFs del lote en un único clustering.
    8. Compara cada grupo contra tipos existentes.
    9. Crea los registros Grupo y asigna las Pagina correspondientes.
    10. Retorna lote_id, total_paginas, total_grupos.
    """
    if not archivos:
        return False, {'error': 'No se enviaron archivos para procesar'}

    for nombre, contenido in archivos:
        if len(contenido) > TAMANO_MAXIMO_PDF:
            return False, {
                'error': f'El archivo {nombre} es demasiado grande ({len(contenido) // (1024 * 1024)} MB, '
                         f'máximo {TAMANO_MAXIMO_PDF // (1024 * 1024)} MB)'
            }

    if unidad is None and usuario is not None:
        unidad = getattr(usuario, 'unidad', None)
    if unidad is None:
        from apps.core.models import Unidad
        unidad, _ = Unidad.objects.get_or_create(
            codigo="LEGACY", defaults={"nombre": "Unidad Legacy Transitoria"}
        )

    # Resolución de persona (opcional)
    persona = None
    if persona_id:
        try:
            persona = Persona.objects.filter(id=persona_id, unidad=unidad).first()
        except (ValueError, TypeError):
            persona = None

    if not persona:
        for nom, _ in archivos:
            p, _, _ = resolver_persona(nom, unidad=unidad)
            if p:
                persona = p
                break

    from apps.documentos.models import Lote, Grupo, Pagina, TipoDocumento
    from apps.documentos.agrupador import agrupar, comparar_con_tipos, extraer_firma
    from apps.storage.services import MinIOService
    import fitz

    storage = MinIOService()
    codigo_folder = persona.codigo if persona else f"unidad_{getattr(unidad, 'codigo', 'general')}"

    nombre_lote = archivos[0][0] if len(archivos) == 1 else f"{len(archivos)} PDFs ({archivos[0][0]}, ...)"

    lote = Lote.objects.create(
        unidad=unidad,
        subido_por=usuario,
        persona=persona,
        nombre_archivo_original=nombre_lote,
        estado='pendiente_nombres',
    )

    try:
        paginas_creadas = []

        for nombre_archivo, contenido_archivo in archivos:
            pdf_key = storage.upload_pdf(codigo_folder, nombre_archivo, contenido_archivo)
            pdf_doc = fitz.open(stream=contenido_archivo, filetype="pdf")

            for page_num in range(len(pdf_doc)):
                page = pdf_doc.load_page(page_num)
                text = page.get_text() or ""
                phash_val = PDFProcessor._calcular_phash(page)

                pag = Pagina(
                    unidad=unidad,
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

        # Agrupamiento jerárquico determinista de TODAS las páginas de todos los PDFs
        grupos_res = agrupar(paginas_creadas)
        tipos_existentes = list(TipoDocumento.objects.filter(unidad=unidad, activo=True))

        for gr in grupos_res:
            tipo_sugerido = comparar_con_tipos(gr, tipos_existentes)
            estado_grupo = 'coincide_con_tipo' if tipo_sugerido else 'nuevo'

            grupo_db = Grupo.objects.create(
                unidad=unidad,
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

        lote.total_paginas = len(paginas_creadas)
        lote.total_grupos = len(grupos_res)
        lote.save(update_fields=['total_paginas', 'total_grupos'])

        return True, {
            'archivo': nombre_lote,
            'lote_id': lote.id,
            'total_paginas': lote.total_paginas,
            'total_grupos': lote.total_grupos,
            'paginas': lote.total_paginas,
            'persona_id': persona.id if persona else None,
            'persona_codigo': persona.codigo if persona else None,
            'persona_nombre': f"{persona.nombres} {persona.apellidos}" if persona else None,
        }

    except Exception as e:
        lote.estado = 'descartado'
        lote.save(update_fields=['estado'])
        return False, {'error': f"Error al procesar lote: {str(e)}"}