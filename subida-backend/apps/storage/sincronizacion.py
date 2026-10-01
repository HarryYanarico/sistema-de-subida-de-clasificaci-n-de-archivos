from django.utils import timezone

from apps.documentos.models import Documento, OrigenArchivos, Sincronizacion
from apps.storage.ingesta import TAMANO_MAXIMO_PDF, procesar_ingesta, resolver_persona
from apps.storage.pdf_processor import PDFProcessor
from apps.storage.providers import ErrorArchivo, ErrorProveedor, obtener_proveedor

MAX_DETALLE = 500

CAMPOS_CONTADOR = (
    'encontrada',
    'procesados',
    'omitidos_ya_importados',
    'omitidos_sin_codigo',
    'omitidos_sin_persona',
    'omitidos_tamano',
    'omitidos_no_pdf',
    'paginas',
    'errores',
)


def _contadores_vacios():
    return {campo: 0 for campo in CAMPOS_CONTADOR}


def sincronizar_origen(origen, usuario=None, limite=None, dry_run=False):
    contadores = _contadores_vacios()
    detalles = []
    processor = None

    sincronizacion = None
    if not dry_run:
        sincronizacion = Sincronizacion.objects.create(origen=origen)

    try:
        proveedor = obtener_proveedor(origen)
        archivos = proveedor.listar(desde=origen.marca_tiempo, limite=limite)
    except ErrorProveedor as e:
        return _cerrar(origen, sincronizacion, 'fallida', contadores, detalles,
                       str(e), dry_run)

    contadores['encontrada'] = len(archivos)

    for archivo in archivos:
        if not archivo.importable:
            contadores['omitidos_no_pdf'] += 1
            detalles.append({
                'archivo': archivo.nombre, 'id': archivo.id,
                'error': f'No es un PDF importable ({archivo.mime or "sin tipo"})',
            })
            continue

        if Documento.objects.filter(origen_id=archivo.id).exists():
            contadores['omitidos_ya_importados'] += 1
            continue

        persona, codigo, error_validacion = resolver_persona(archivo.nombre, origen.unidad)
        if error_validacion:
            if codigo:
                contadores['omitidos_sin_persona'] += 1
            else:
                contadores['omitidos_sin_codigo'] += 1
            detalles.append({
                'archivo': archivo.nombre, 'id': archivo.id, 'error': error_validacion,
            })
            continue

        if archivo.tamano > TAMANO_MAXIMO_PDF:
            contadores['omitidos_tamano'] += 1
            detalles.append({
                'archivo': archivo.nombre, 'id': archivo.id,
                'error': f'Supera el máximo de {TAMANO_MAXIMO_PDF // (1024 * 1024)} MB',
            })
            continue

        try:
            contenido = proveedor.descargar(archivo)
        except ErrorProveedor as e:
            return _cerrar(origen, sincronizacion, 'fallida', contadores, detalles,
                           str(e), dry_run)
        except ErrorArchivo as e:
            contadores['errores'] += 1
            detalles.append({'archivo': archivo.nombre, 'id': archivo.id, 'error': str(e)})
            continue

        if processor is None:
            processor = PDFProcessor()

        ok, resultado = procesar_ingesta(
            archivo.nombre, contenido, origen.unidad, usuario,
            origen_id=archivo.id, processor=processor,
        )
        if ok:
            contadores['procesados'] += 1
            contadores['paginas'] += resultado['paginas']
            detalles.append({
                'archivo': archivo.nombre, 'id': archivo.id,
                'persona_codigo': resultado['persona_codigo'],
                'paginas': resultado['paginas'],
            })
        else:
            contadores['errores'] += 1
            detalles.append({
                'archivo': archivo.nombre, 'id': archivo.id, 'error': resultado['error'],
            })

    pendientes = (
        contadores['errores']
        + contadores['omitidos_sin_codigo']
        + contadores['omitidos_sin_persona']
        + contadores['omitidos_no_pdf']
        + contadores['omitidos_tamano']
    )
    estado = 'exitosa' if pendientes == 0 else 'con_errores'

    return _cerrar(
        origen, sincronizacion, estado, contadores, detalles, '', dry_run,
        avanzar=(pendientes == 0), archivos=archivos,
    )


def sincronizar_activos(usuario=None, limite=None, dry_run=False):
    resultados = []
    for origen in OrigenArchivos.objects.filter(activo=True).select_related('unidad'):
        try:
            resultado = sincronizar_origen(origen, usuario=usuario, limite=limite, dry_run=dry_run)
        except Exception as e:
            resultado = {'estado': 'fallida', 'mensaje': str(e), **_contadores_vacios(), 'detalle': []}
        resultados.append((origen, resultado))
    return resultados


def resultado_dict(resultado):
    """Normaliza el retorno de sincronizar_origen a un dict.

    Returns un dict en dry_run y un modelo Sincronizacion en el resto de casos.
    """
    if isinstance(resultado, dict):
        return resultado
    datos = {campo: getattr(resultado, campo, 0) for campo in CAMPOS_CONTADOR}
    datos.update({
        'id': resultado.id,
        'origen_id': resultado.origen_id,
        'estado': resultado.estado,
        'mensaje': resultado.mensaje,
        'detalle': resultado.detalle,
    })
    return datos


def _cerrar(origen, sincronizacion, estado, contadores, detalles, mensaje, dry_run,
            avanzar=False, archivos=()):
    if not mensaje:
        mensaje = (
            f"{contadores['procesados']} procesado(s), "
            f"{contadores['paginas']} página(s), "
            f"{contadores['omitidos_ya_importados']} ya importado(s), "
            f"{contadores['errores']} error(es)"
        )

    nuevo_marca = None
    if avanzar and archivos:
        modificados = [a.modificado for a in archivos if a.modificado]
        if modificados:
            nuevo_marca = max(modificados)

    if dry_run:
        return {
            'origen_id': origen.id, 'estado': estado, 'mensaje': mensaje,
            'marca_tiempo_propuesta': nuevo_marca, **contadores,
            'detalle': detalles[:MAX_DETALLE],
        }

    if nuevo_marca is not None:
        origen.marca_tiempo = nuevo_marca
    origen.ultima_sincronizacion = timezone.now()
    origen.ultimo_error = mensaje if estado == 'fallida' else ''
    origen.save(update_fields=[
        'marca_tiempo', 'ultima_sincronizacion', 'ultimo_error', 'updated_at',
    ])

    sincronizacion.estado = estado
    sincronizacion.mensaje = mensaje
    sincronizacion.detalle = detalles[:MAX_DETALLE]
    for campo, valor in contadores.items():
        setattr(sincronizacion, campo, valor)
    sincronizacion.save()
    return sincronizacion
