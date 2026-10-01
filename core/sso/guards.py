"""
Decoradores de resolvers: autenticación, permisos y registro de fallos.

Orden correcto:

    @strawberry.mutation
    @RequiereAutenticacion
    @RequierePermiso(Permisos.IMPRIMIR)
    @RegistrarActividad("impresion de titulo")
    def mi_resolver(self, info, ...): ...

`@RegistrarActividad` estampa `__bitacora_accion__` en el wrapper; como
`functools.wraps` copia el `__dict__`, ese atributo sube por toda la cadena
y los guards de arriba pueden leerlo. Por eso el orden importa: si
`@RegistrarActividad` no es el más interno, los guards no encuentran la
descripción y no registran nada.

Si el resolver NO tiene `@RegistrarActividad`, los guards no registran nada
en bitácora — el paquete nunca adivina ni transforma nombres de métodos.

Casos registrados (solo con @RegistrarActividad presente):
  🔑 Sin token       → "Intento de <accion> sin autenticacion"
  ⛔ Token inválido  → "Intento de <accion> sin autorizacion"
  🔒 Sin permiso     → "Intento de <accion> sin permiso"

⚠ Estos decoradores son síncronos. Con un resolver `async def`, `func(...)`
devuelve una corrutina sin await: la autenticación funciona (corre antes),
pero la bitácora registraría el resultado antes de que el resolver ejecute.
No usar con resolvers async hasta que se agregue la variante asíncrona.
"""

import functools
from typing import Callable, Optional

import strawberry
from graphql import GraphQLError

from .autenticacion import GuardAutenticacion, GuardPermisos
from .errores import CodigosError, codigo_de, error_auth


# ──────────────────────────────────────────────────────────── helpers

def _extraer_info(*args, **kwargs) -> Optional[strawberry.Info]:
    info = kwargs.get('info')
    if info:
        return info
    for arg in args:
        if isinstance(arg, strawberry.Info):
            return arg
    return None


def _exigir_info(*args, **kwargs) -> strawberry.Info:
    info = _extraer_info(*args, **kwargs)
    if not info:
        raise error_auth(
            "El resolver debe tener un parámetro 'info: strawberry.Info'",
            CodigosError.RESOLVER_MISCONFIGURED,
        )
    return info


def _accion_bitacora(func: Callable, sufijo: str) -> Optional[str]:
    """
    Lee `func.__bitacora_accion__` estampado por @RegistrarActividad.
    None → el resolver no está decorado y no se registra nada.
    """
    accion_base = getattr(func, '__bitacora_accion__', None)
    if not accion_base:
        return None
    return f"Intento de {accion_base} {sufijo}"


def _registrar_fallo(info, func: Callable, accion: Optional[str], kwargs: dict) -> None:
    """
    Registra un intento fallido en bitácora.

    La dependencia con `core.auditoria` es deliberadamente perezosa y
    silenciosa: el paquete SSO funciona sin bitácora instalada, y un fallo
    de auditoría nunca puede convertirse en un fallo de autenticación.
    """
    if not accion:
        return

    try:
        from core.auditoria.serializers import serializar_kwargs
        from core.auditoria.services import es_mutacion, obtener_ip, registrar_en_bitacora

        usuario = getattr(info.context, 'usuario', None)
        request = getattr(info.context, 'request', None)

        entrada = serializar_kwargs(kwargs) if kwargs else {}

        def campo(clave, defecto):
            return str(usuario.get(clave, defecto)) if usuario else defecto

        registrar_en_bitacora(
            usuario_id=campo('id_usuario', 'anonimo'),
            device_hash=campo('device_hash', 'desconocido'),
            nombre=campo('nombre', 'anonimo'),
            codigo_usuario=campo('codigo_usuario', 'desconocido'),
            profile_picture_url=campo('profile_picture_url', ''),
            ip=obtener_ip(request),
            accion=accion,
            tipo='mutacion' if es_mutacion(func.__name__) else 'consulta',
            detalles={'intento': entrada} if entrada else {},
            estado='fallido',
        )
    except Exception:
        pass


# Códigos que significan "traía un token, pero no servía".
_CODIGOS_SIN_AUTORIZACION = frozenset({
    CodigosError.TOKEN_EXPIRED,
    CodigosError.TOKEN_INVALID,
    CodigosError.TOKEN_WRONG_AUDIENCE,
    CodigosError.SSO_SESSION_REVOKED,
    CodigosError.SSO_SESSION_EXPIRED,
    CodigosError.AUTH_ERROR,
})

# Respaldo por texto, solo para errores sin código: guards propios de un
# sistema, o versiones viejas del paquete conviviendo en el mismo proyecto.
_TEXTOS_SIN_AUTORIZACION = (
    'expirado', 'inválido', 'invalido', 'invalid', 'expired', 'error al validar',
)


def _clasificar_error_autenticacion(exc: GraphQLError) -> str:
    """
    Distingue token ausente de token inválido/expirado, para nombrar el fallo
    en la bitácora.

      sin autenticacion → no había token
      sin autorizacion  → había token pero era inválido, expiró o fue revocado

    Clasifica por `extensions.code`. Si el error no trae código (no salió de
    este paquete), cae al matcheo por texto de siempre.
    """
    codigo = codigo_de(exc)
    if codigo:
        return 'sin autorizacion' if codigo in _CODIGOS_SIN_AUTORIZACION else 'sin autenticacion'

    mensaje = str(exc).lower()
    if any(frase in mensaje for frase in _TEXTOS_SIN_AUTORIZACION):
        return 'sin autorizacion'
    return 'sin autenticacion'


# ────────────────────────────────────────────────────────── decoradores

def RequiereAutenticacion(func: Callable) -> Callable:
    """Exige un token válido. Deja el usuario en `info.context.usuario`."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        info = _exigir_info(*args, **kwargs)
        try:
            GuardAutenticacion.autenticar(info)
        except GraphQLError as exc:
            sufijo = _clasificar_error_autenticacion(exc)
            _registrar_fallo(info, func, _accion_bitacora(func, sufijo), kwargs)
            raise
        return func(*args, **kwargs)
    return wrapper


def _decorador_de_permisos(verificar: Callable) -> Callable:
    """
    Fábrica de decoradores de permiso.

    Las tres variantes (uno / alguno / todos) solo se diferencian en qué
    verificador llaman; antes eran tres bloques idénticos de 15 líneas.
    """
    def constructor(*permisos: str) -> Callable:
        def decorador(func: Callable) -> Callable:
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                info = _exigir_info(*args, **kwargs)
                try:
                    verificar(info, permisos)
                except GraphQLError:
                    _registrar_fallo(info, func, _accion_bitacora(func, 'sin permiso'), kwargs)
                    raise
                return func(*args, **kwargs)
            return wrapper
        return decorador
    return constructor


RequierePermiso = _decorador_de_permisos(
    lambda info, permisos: GuardPermisos.verificar_permiso(info, permisos[0])
)
RequierePermiso.__doc__ = "Exige un permiso exacto: @RequierePermiso(Permisos.IMPRIMIR)"

RequiereAlgunPermiso = _decorador_de_permisos(
    lambda info, permisos: GuardPermisos.verificar_algun_permiso(info, list(permisos))
)
RequiereAlgunPermiso.__doc__ = "Exige al menos uno de los permisos indicados."

RequiereTodosPermisos = _decorador_de_permisos(
    lambda info, permisos: GuardPermisos.verificar_todos_permisos(info, list(permisos))
)
RequiereTodosPermisos.__doc__ = "Exige todos los permisos indicados."
