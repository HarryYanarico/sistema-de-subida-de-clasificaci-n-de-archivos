"""
Decorador `@RegistrarActividad`.

Registra en la bitácora cada resolver decorado. La descripción es obligatoria:

    @RegistrarActividad("creacion y envio de tramite")
    def crear_y_distribuir_tramite(self, info, ...): ...

⚠ Las guías de instalación muestran `@RegistrarActividad` sin argumentos. Esa
forma NO funciona: lanza ValueError en tiempo de import. La descripción manual
es obligatoria a propósito — el paquete nunca inventa un nombre de acción a
partir del nombre del método.

El decorador estampa la descripción en `__bitacora_accion__` del wrapper para
que los guards de `core.sso` la lean y registren sus fallos con el mismo texto.
Por eso `@RegistrarActividad` debe ser el decorador MÁS INTERNO (el más cercano
al `def`): `functools.wraps` propaga el atributo hacia arriba, nunca hacia abajo.

Casos cubiertos:
  ✅ Exitoso          → "creacion y envio de tramite"
  ❌ Error genérico   → "intento de creacion y envio de tramite, error: ..."
  🔒 Sin permiso      → lo registra el guard de core.sso
  🔑 Sin token        → lo registra el guard de core.sso

⚠ Decorador síncrono. Con un resolver `async def`, `func(...)` devuelve una
corrutina sin await: se registraría 'exitoso' antes de que el resolver corra,
y el `except` nunca vería sus errores.
"""

import functools
import logging

from .serializers import serializar_kwargs
from .services import es_mutacion, obtener_ip, registrar_en_bitacora

logger = logging.getLogger(__name__)

_LARGO_MAXIMO_ERROR = 150


def RegistrarActividad(accion_nombre: str):
    """
    Registra la actividad del resolver en la bitácora.

    Args:
        accion_nombre: descripción legible de la acción. Obligatoria.

    Contenido de `detalles` según el caso:
        consulta           → {'parametros': {...kwargs}}
        mutación exitosa   → {'entrada':    {...kwargs}}
        mutación fallida   → {'intento':    {...kwargs}}
    """
    if not isinstance(accion_nombre, str) or not accion_nombre.strip():
        raise ValueError(
            "@RegistrarActividad requiere una descripción manual. "
            "Ejemplo: @RegistrarActividad('creacion de tramite')"
        )

    accion_base = accion_nombre.strip()

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            info = _extraer_info(*args, **kwargs)
            usuario = getattr(info.context, 'usuario', None) if info else None
            request = getattr(info.context, 'request', None) if info else None

            ip = obtener_ip(request)
            tipo = 'mutacion' if es_mutacion(func.__name__) else 'consulta'

            estado = 'exitoso'
            accion = accion_base

            try:
                resultado = func(*args, **kwargs)

            except Exception as exc:
                estado = 'fallido'
                razon = _limpiar_mensaje_error(str(exc))
                accion = (
                    f"intento de {accion_base}, error: {razon}"
                    if razon else
                    f"intento de {accion_base}"
                )
                raise

            finally:
                _publicar(
                    usuario=usuario,
                    ip=ip,
                    accion=accion,
                    tipo=tipo,
                    estado=estado,
                    kwargs=kwargs,
                )

            return resultado

        # Lo leen los guards de core.sso para registrar sus propios fallos
        # con esta misma descripción.
        wrapper.__bitacora_accion__ = accion_base
        return wrapper

    return decorator


# ─────────────────────────────────────────────────────────── internos

def _extraer_info(*args, **kwargs):
    """Localiza el contexto GraphQL entre los argumentos del resolver."""
    info = kwargs.get('info')
    if info:
        return info
    for arg in args:
        if hasattr(arg, 'context'):
            return arg
    return None


def _publicar(*, usuario, ip, accion, tipo, estado, kwargs) -> None:
    """
    Arma el registro y lo publica. Nunca propaga excepciones: la bitácora no
    puede romper el resolver que está auditando.
    """
    datos = {
        'usuario_id':          'anonimo',
        'device_hash':         'desconocido',
        'nombre':              'anonimo',
        'codigo_usuario':      'desconocido',
        'profile_picture_url': '',
    }
    detalles = {}

    if usuario:
        datos = {
            'usuario_id':          str(usuario.get('id_usuario', 'desconocido')),
            'device_hash':         str(usuario.get('device_hash', 'desconocido')),
            'nombre':              str(usuario.get('nombre', 'anonimo')),
            'codigo_usuario':      str(usuario.get('codigo_usuario', 'desconocido')),
            'profile_picture_url': str(usuario.get('profile_picture_url', '')),
        }

        entrada = serializar_kwargs(kwargs)
        if entrada:
            if tipo == 'consulta':
                detalles = {'parametros': entrada}
            elif estado == 'exitoso':
                detalles = {'entrada': entrada}
            else:
                detalles = {'intento': entrada}

    try:
        registrar_en_bitacora(
            ip=ip,
            accion=accion,
            tipo=tipo,
            detalles=detalles,
            estado=estado,
            **datos,
        )
        logger.info("[Bitácora] Evento registrado: %s", accion)
    except Exception as e:
        logger.error("[Bitácora] Error al registrar evento: %s", e, exc_info=True)


def _limpiar_mensaje_error(mensaje: str) -> str:
    """
    Extrae la parte útil del mensaje de error: primera línea, sin el prefijo
    técnico del tipo de excepción, y truncada.
    """
    if not mensaje:
        return ''

    primera_linea = mensaje.split('\n')[0].strip()

    if ': ' in primera_linea:
        prefijo, resto = primera_linea.split(': ', 1)
        if len(prefijo) < 50:
            primera_linea = resto.strip()

    if len(primera_linea) > _LARGO_MAXIMO_ERROR:
        primera_linea = primera_linea[:_LARGO_MAXIMO_ERROR - 3] + '...'

    return primera_linea
