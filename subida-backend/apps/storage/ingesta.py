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


def resolver_persona(nombre: str) -> tuple:
    """
    Resuelve la persona correspondiente al archivo.
    Principio: 'El regex propone, la tabla dispone'.
    Si hay múltiples números (ej: código y año 2024), valida contra la tabla Persona.
    """
    candidatos = extract_candidate_codes(nombre)
    if not candidatos:
        return None, None, ERROR_NOMBRE_INVALIDO

    persona = None
    codigo_seleccionado = candidatos[0]

    # Buscar cuál de los candidatos existe realmente en la base de datos
    for cand in candidatos:
        p = Persona.objects.filter(codigo=cand).first()
        if p:
            persona = p
            codigo_seleccionado = cand
            break

    if not persona:
        return None, codigo_seleccionado, f'No se encontró persona con código {codigo_seleccionado}'

    return persona, codigo_seleccionado, None


def procesar_ingesta(nombre, contenido, usuario, processor=None):
    persona, codigo, error_validacion = resolver_persona(nombre)

    if error_validacion:
        return False, {'error': error_validacion}

    if len(contenido) > TAMANO_MAXIMO_PDF:
        return False, {
            'error': f'Archivo demasiado grande ({len(contenido) // (1024 * 1024)} MB, '
                     f'máximo {TAMANO_MAXIMO_PDF // (1024 * 1024)} MB)'
        }

    if processor is None:
        processor = PDFProcessor()

    try:
        results = processor.process_pdf(
            persona.codigo, nombre, contenido, persona=persona
        )

        paginas = 0
        duplicados = 0
        for result in results:
            phash = result.get('phash')
            # Se busca antes de crear: el duplicado es el que ya existe, asi
            # que una segunda copia del mismo PDF no se marca a si misma.
            original_id = buscar_duplicado(phash) if phash else None

            Documento.objects.create(
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