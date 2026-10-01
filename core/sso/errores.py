"""
Códigos de error de autenticación y autorización.

Todo `GraphQLError` que lanza este paquete lleva `extensions.code`. El cliente
decide qué hacer mirando el código, nunca el texto del mensaje.

Antes solo `SSO_SESSION_REVOKED` viajaba como código; el resto era texto plano,
así que el frontend tenía que hacer `mensaje.includes("expirado")` para saber
si le convenía renovar el token. Cambiar una tilde en un mensaje rompía el
manejo de sesión de todos los sistemas, en silencio.

Los mensajes siguen siendo los mismos: esto se agrega, no reemplaza nada.

Contrato con el frontend
────────────────────────
  UNAUTHENTICATED       falta el token o no es utilizable  → renovar y reintentar
  TOKEN_EXPIRED         el JWT venció                      → renovar y reintentar
  TOKEN_INVALID         firma o formato inválidos          → renovar y reintentar
  TOKEN_WRONG_AUDIENCE  el token es de otro sistema        → volver al login
  SSO_SESSION_REVOKED   el dispositivo fue revocado        → cerrar sesión, NO renovar
  SSO_SESSION_EXPIRED   fuera de la ventana horaria        → cerrar sesión, NO renovar
  FORBIDDEN             falta el permiso                   → mostrar el error, nada más
  AUTH_ERROR            fallo interno al autenticar        → mostrar el error
  RESOLVER_MISCONFIGURED  bug del backend                  → reportarlo

La regla que importa: `CODIGOS_RENOVABLES` es el único conjunto ante el cual
tiene sentido llamar a `/api/sso/refresh-session` y reintentar. Con cualquier
otro, reintentar solo repite el fallo — o peor, revive una sesión que el IdP
ya decidió cerrar.
"""

from graphql import GraphQLError


class CodigosError:
    """Valores de `extensions.code`. Son parte del contrato con el frontend."""

    UNAUTHENTICATED      = "UNAUTHENTICATED"
    TOKEN_EXPIRED        = "TOKEN_EXPIRED"
    TOKEN_INVALID        = "TOKEN_INVALID"
    TOKEN_WRONG_AUDIENCE = "TOKEN_WRONG_AUDIENCE"
    FORBIDDEN            = "FORBIDDEN"
    AUTH_ERROR           = "AUTH_ERROR"

    # Nombres históricos: los frontends ya los manejan, no cambiar los valores.
    SSO_SESSION_REVOKED  = "SSO_SESSION_REVOKED"
    SSO_SESSION_EXPIRED  = "SSO_SESSION_EXPIRED"

    # Bug del backend: un resolver protegido sin parámetro `info`.
    RESOLVER_MISCONFIGURED = "RESOLVER_MISCONFIGURED"


#: Códigos que se resuelven renovando el access token y reintentando una vez.
CODIGOS_RENOVABLES = frozenset({
    CodigosError.UNAUTHENTICATED,
    CodigosError.TOKEN_EXPIRED,
    CodigosError.TOKEN_INVALID,
})

#: Códigos ante los que hay que cerrar la sesión sin intentar renovarla.
CODIGOS_TERMINALES = frozenset({
    CodigosError.SSO_SESSION_REVOKED,
    CodigosError.SSO_SESSION_EXPIRED,
    CodigosError.TOKEN_WRONG_AUDIENCE,
})


def error_auth(mensaje: str, codigo: str) -> GraphQLError:
    """Construye un GraphQLError con su código. Devuelve, no lanza."""
    return GraphQLError(mensaje, extensions={"code": codigo})


def codigo_de(exc: Exception) -> str | None:
    """
    Extrae `extensions.code` de un GraphQLError, o None si no lo tiene.

    Tolera errores de terceros y GraphQLError sin extensions, para que quien
    lo use no necesite envolverlo en try/except.
    """
    extensiones = getattr(exc, "extensions", None)
    if isinstance(extensiones, dict):
        codigo = extensiones.get("code")
        if isinstance(codigo, str):
            return codigo
    return None
