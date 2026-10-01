"""
Guards de autenticación y autorización.

Dos responsabilidades, deliberadamente juntas porque comparten el mismo
contrato (`info.context.request.user`) y se usan siempre en pareja:

  GuardAutenticacion → ¿quién es? Valida el token y arma el usuario.
  GuardPermisos      → ¿puede? Consulta los permisos del usuario ya armado.

Los decoradores que envuelven resolvers viven en `guards.py`; acá está la
lógica que ellos invocan.
"""

import logging

import strawberry
from graphql import GraphQLError

from .errores import CodigosError, error_auth
from .tokens import DecodificadorJWT
from .usuario import UsuarioExterno
from .validator import validar_estado_sso

logger = logging.getLogger(__name__)

_MENSAJE_DENEGADO = "Acceso denegado. No tienes privilegios para realizar esta acción."


class GuardAutenticacion:
    """Resuelve la identidad del usuario a partir del token de la request."""

    @staticmethod
    def obtener_token(info: strawberry.Info) -> str | None:
        """Busca el token en la cookie de sesión y, como respaldo, en el header."""
        request = info.context.request

        token = request.COOKIES.get('sso_access_token')
        if token:
            return token

        auth = request.headers.get('Authorization', '')
        if auth.startswith('Bearer '):
            return auth.split(' ', 1)[1].strip()

        return None

    @staticmethod
    def autenticar(info: strawberry.Info) -> dict:
        """
        Valida el token, verifica el estado de la sesión SSO y deja el usuario
        disponible en `info.context.usuario` y en `info.context.request.user`.

        Returns:
            dict con los datos del usuario ya normalizados.

        Raises:
            GraphQLError: sin token, token inválido/expirado o sesión revocada.
        """
        token = GuardAutenticacion.obtener_token(info)

        if not token:
            raise error_auth(
                "No autenticado. Proporciona un token válido.",
                CodigosError.UNAUTHENTICATED,
            )

        try:
            # 1. Verificar firma RSA y vigencia
            token_decodificado = DecodificadorJWT.decodificar_token(token)

            # 2. Estado de la sesión SSO en Redis local (revocación de dispositivo).
            #    Un fallo de infraestructura acá no debe tumbar la autenticación:
            #    solo los rechazos explícitos (GraphQLError) cortan el request.
            try:
                validar_estado_sso(token_decodificado)
            except GraphQLError:
                raise
            except Exception as e:
                logger.warning("[AUTH] validar_estado_sso no disponible: %s", e)

            # 3. Normalizar datos según el formato del token
            datos_usuario = DecodificadorJWT.extraer_datos_usuario(token_decodificado)

            # 4. Usuario en memoria (stateless) e inyección en el contexto
            info.context.usuario = datos_usuario
            info.context.request.user = UsuarioExterno.desde_dict(datos_usuario)

            return datos_usuario

        except GraphQLError:
            # Ya viene formateado (expirado, firma inválida, revocado…)
            raise
        except Exception as e:
            # A02: no exponer detalles internos al cliente
            logger.error("Error inesperado en autenticación: %s", e, exc_info=True)
            raise error_auth(
                "Error de autenticación. Por favor, inicia sesión nuevamente.",
                CodigosError.AUTH_ERROR,
            )


class GuardPermisos:
    """
    Verifica permisos contra el usuario ya inyectado por GuardAutenticacion.

    Usa `has_perm`, que respeta automáticamente a los superusuarios.

    Los mensajes al cliente nunca nombran el permiso requerido: enumerar los
    códigos exactos que faltan le da a un atacante el mapa de la autorización.
    El detalle va al log del servidor, donde sí sirve para depurar.
    """

    @staticmethod
    def _usuario(info: strawberry.Info):
        usuario = info.context.request.user
        if not usuario.is_authenticated:
            raise error_auth(
                "Usuario no autenticado. Inicia sesión primero.",
                CodigosError.UNAUTHENTICATED,
            )
        return usuario

    @staticmethod
    def _denegar(usuario, detalle: str, valor) -> GraphQLError:
        """Loguea el detalle del rechazo y devuelve el error genérico."""
        logger.info(
            "[AUTZ] Permiso denegado usuario=%s %s=%s",
            getattr(usuario, 'user_id', '?'), detalle, valor,
        )
        return error_auth(_MENSAJE_DENEGADO, CodigosError.FORBIDDEN)

    @staticmethod
    def verificar_permiso(info: strawberry.Info, permiso_requerido: str) -> bool:
        usuario = GuardPermisos._usuario(info)

        if usuario.has_perm(permiso_requerido):
            return True

        raise GuardPermisos._denegar(usuario, "requerido", permiso_requerido)

    @staticmethod
    def verificar_algun_permiso(info: strawberry.Info, permisos_requeridos: list) -> bool:
        usuario = GuardPermisos._usuario(info)

        if usuario.is_superuser:
            return True

        if any(usuario.has_perm(permiso) for permiso in permisos_requeridos):
            return True

        raise GuardPermisos._denegar(usuario, "requiere alguno de", permisos_requeridos)

    @staticmethod
    def verificar_todos_permisos(info: strawberry.Info, permisos_requeridos: list) -> bool:
        usuario = GuardPermisos._usuario(info)

        if usuario.is_superuser:
            return True

        faltantes = [p for p in permisos_requeridos if not usuario.has_perm(p)]
        if not faltantes:
            return True

        raise GuardPermisos._denegar(usuario, "faltan", faltantes)
