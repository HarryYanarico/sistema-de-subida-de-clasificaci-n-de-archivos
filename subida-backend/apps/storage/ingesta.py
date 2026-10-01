import re

from apps.documentos.models import Documento
from apps.personas.models import Persona
from apps.storage.pdf_processor import PDFProcessor

TAMANO_MAXIMO_PDF = 50 * 1024 * 1024

ERROR_NOMBRE_INVALIDO = (
    'Nombre de archivo inválido. No se pudieron extraer 5 o más dígitos '
    '(ej: 12345678.pdf o Acta_12345678.pdf)'
)


def extract_digits_from_filename(filename: str) -> str:
    name = filename.rsplit('.', 1)[0]
    return re.sub(r'[^0-9]', '', name)


def resolver_persona(nombre: str, unidad) -> tuple:
    codigo = extract_digits_from_filename(nombre)
    if not re.match(r'^\d{5,}$', codigo):
        return None, None, ERROR_NOMBRE_INVALIDO
    persona = Persona.objects.filter(codigo=codigo, unidad=unidad).first()
    if not persona:
        return None, codigo, f'No se encontró persona con código {codigo} en esta unidad'
    return persona, codigo, None


def procesar_ingesta(nombre, contenido, unidad, usuario, origen_id=None, processor=None):
    persona, codigo, error_validacion = resolver_persona(nombre, unidad)

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
            persona.codigo, nombre, contenido, unidad=unidad
        )

        paginas = 0
        for result in results:
            Documento.objects.create(
                persona=persona,
                tipo_documento=result['tipo_documento'],
                archivo_original=result['archivo_original'],
                pagina_numero=result['pagina_numero'],
                texto_extraido=result['texto_extraido'],
                estado='clasificado' if result['tipo_documento'] else 'pendiente',
                subido_por=usuario,
                origen_id=origen_id,
            )
            paginas += 1

        return True, {
            'archivo': nombre,
            'persona_id': persona.id,
            'persona_codigo': persona.codigo,
            'persona_nombre': f'{persona.nombres} {persona.apellidos}',
            'paginas': paginas,
        }
    except Exception as e:
        return False, {'error': f'Error al procesar: {str(e)}'}