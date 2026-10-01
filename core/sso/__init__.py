"""
Cliente SSO del IdP admincentral UAGRM.

Reúne todo el ciclo de vida de la identidad de un usuario. Antes estaba
partido en dos paquetes (`core/autenticacion` y `core/uagrm_sso`) que se
importaban mutuamente por ruta absoluta; unificarlos elimina ese acoplamiento
y deja los imports internos relativos.

    Login y renovación      views.py, client.py, urls.py
    Verificación del JWT    tokens.py
    Estado local de sesión  state.py, validator.py, consumer.py, notify.py
    Guards de resolvers     guards.py, autenticacion.py, usuario.py
    Configuración           config.py  ← todos los settings, en un solo lugar

Uso típico:

    from core.sso import RequiereAutenticacion, RequierePermiso
    from core.permisos import Permisos

    @strawberry.mutation
    @RequiereAutenticacion
    @RequierePermiso(Permisos.IMPRIMIR)
    @RegistrarActividad("impresion de titulo")
    def imprimir(self, info: strawberry.Info) -> bool:
        usuario = info.context.usuario
        ...

Requiere: Django, Strawberry GraphQL, PyJWT, cryptography, requests,
django-redis, kombu, redis.
"""

__version__ = "2.0.0"

from .autenticacion import GuardAutenticacion, GuardPermisos
from .client import exchange_ticket, refresh_token
from .errores import (
    CODIGOS_RENOVABLES,
    CODIGOS_TERMINALES,
    CodigosError,
    codigo_de,
    error_auth,
)
from .guards import (
    RequiereAlgunPermiso,
    RequiereAutenticacion,
    RequierePermiso,
    RequiereTodosPermisos,
)
from .state import (
    check_perm,
    get_local_dv,
    get_local_perms,
    get_local_pv,
    limpiar_revocacion,
    marcar_sesion_revocada,
    motivo_revocacion,
    seed_from_jwt,
    sesion_revocada,
)
from .tokens import DecodificadorJWT
from .usuario import UsuarioExterno
from .validator import SSO_EXPIRED_CODE, SSO_REVOKED_CODE, validar_estado_sso

__all__ = [
    # Guards de resolvers
    "RequiereAutenticacion",
    "RequierePermiso",
    "RequiereAlgunPermiso",
    "RequiereTodosPermisos",
    # Piezas internas reutilizables
    "GuardAutenticacion",
    "GuardPermisos",
    "DecodificadorJWT",
    "UsuarioExterno",
    # Cliente del IdP
    "exchange_ticket",
    "refresh_token",
    # Estado local
    "seed_from_jwt",
    "get_local_perms",
    "get_local_pv",
    "get_local_dv",
    "check_perm",
    # Revocación de sesión
    "marcar_sesion_revocada",
    "motivo_revocacion",
    "sesion_revocada",
    "limpiar_revocacion",
    # Validación por request
    "validar_estado_sso",
    # Códigos de error (extensions.code)
    "CodigosError",
    "CODIGOS_RENOVABLES",
    "CODIGOS_TERMINALES",
    "codigo_de",
    "error_auth",
    "SSO_REVOKED_CODE",   # alias histórico de CodigosError.SSO_SESSION_REVOKED
    "SSO_EXPIRED_CODE",   # alias histórico de CodigosError.SSO_SESSION_EXPIRED
]
