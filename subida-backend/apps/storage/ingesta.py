import re

from apps.documentos.deduplicacion import buscar_duplicado
from apps.documentos.models import Documento
from apps.personas.models import Persona
from apps.storage.clasificador import estado_desde_pagina
from apps.storage.pdf_processor import PDFProcessor

TAMANO_MAXIMO_PDF = 50 * 1024 * 1024

ERROR_NOMBRE_INVALIDO = (
    'Nombre de archivo inválido. No se pudieron extraer 5 o más dígitos '
    '(ej: 12345678.pdf o Acta_12345678.pdf)'
)


def extract_digits_from_filename(filename: str) -> str:
    name = filename.rsplit('.', 1)[0]
    return re.sub(r'[^0-9]', '', name)


def resolver_persona(nombre: str) -> tuple:
    codigo = extract_digits_from_filename(nombre)
    if not re.match(r'^\d{5,}$', codigo):
        return None, None, ERROR_NOMBRE_INVALIDO
    persona = Persona.objects.filter(codigo=codigo).first()
    if not persona:
        return None, codigo, f'No se encontró persona con código {codigo}'
    return persona, codigo, None


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