"""
Verificación y lectura de los JWT emitidos por admincentral.

Este módulo se llamaba `jwt.py` — el mismo nombre que la librería PyJWT que
importa. Con imports absolutos de Python 3 funcionaba, pero cualquier import
relativo dentro del paquete lo volvía ambiguo. De ahí el rename a `tokens.py`.

Soporta dos formatos, detectados por el claim `token_type`:

  sso_access  → campos en la raíz del token; los permisos NO viajan en él,
                se leen de Redis local por `rol_id`.
  access      → formato legacy; campos anidados en `usuario`, permisos dentro
                de roles[].aplicaciones[].permisos[].
"""

import logging
from typing import Any, Dict

import jwt
from graphql import GraphQLError

from . import config
from .errores import CodigosError, error_auth

logger = logging.getLogger(__name__)


class DecodificadorJWT:
    """Decodificador de JWT con verificación asimétrica (RSA)."""

    # ───────────────────────────────────────────────── llave pública

    @staticmethod
    def obtener_llave_publica() -> str | None:
        """
        Devuelve la llave pública lista para usar.

        Retorna None como señal de "saltar verificación", solo cuando la llave
        no está configurada y el bypass de desarrollo está activo.
        """
        llave_publica = config.llave_publica_raw()

        if not llave_publica:
            if config.saltar_verificacion_dev():
                return None  # Señal para saltar verificación en dev
            raise ValueError(
                "JWT_LLAVE_PUBLICA no configurada. "
                "Agrega JWT_LLAVE_PUBLICA en .env"
            )

        # Reemplaza \n literales por saltos de línea reales
        return llave_publica.replace('\\n', '\n')

    # ───────────────────────────────────────────────── decodificación

    @staticmethod
    def decodificar_token(token: str) -> Dict[str, Any]:
        """
        Decodifica y valida un JWT usando la llave pública.

        En DEBUG con JWT_SKIP_VERIFY_DEV=True decodifica sin verificar firma,
        útil cuando la clave pública local no coincide con la del SSO de dev.

        Raises:
            GraphQLError: si el token es inválido o expiró.
        """
        try:
            llave_publica = DecodificadorJWT.obtener_llave_publica()

            # Sin llave pública y en dev → saltar verificación
            if llave_publica is None:
                logger.warning(
                    "[JWT] ⚠️  JWT_LLAVE_PUBLICA no configurada — decodificando SIN "
                    "verificar firma ni vencimiento (JWT_SKIP_VERIFY_DEV=True). "
                    "SOLO para desarrollo."
                )
                return jwt.decode(
                    token,
                    options={'verify_signature': False, 'verify_exp': False},
                    algorithms=['RS256'],
                )

            # verify_aud=False porque los tokens legacy no llevan "aud";
            # los sso_access sí lo llevan y se verifica manualmente abajo.
            decodificado = jwt.decode(
                token,
                llave_publica,
                algorithms=['RS256'],
                options={
                    'verify_signature': True,
                    'verify_exp': True,
                    'verify_iat': True,
                    'verify_aud': False,
                },
            )

            DecodificadorJWT._verificar_audiencia(decodificado)
            return decodificado

        except jwt.ExpiredSignatureError:
            raise error_auth(
                "Token expirado. Por favor, inicia sesión nuevamente.",
                CodigosError.TOKEN_EXPIRED,
            )

        except jwt.InvalidSignatureError:
            return DecodificadorJWT._reintentar_sin_firma_en_dev(token)

        except jwt.InvalidTokenError as e:
            logger.warning("[JWT] Token inválido: %s", e)
            raise error_auth(
                "Token inválido. Por favor, inicia sesión nuevamente.",
                CodigosError.TOKEN_INVALID,
            )

        except GraphQLError:
            raise

        except Exception as e:
            logger.error("[JWT] Error inesperado al validar token: %s", e, exc_info=True)
            raise error_auth(
                "Error de autenticación. Por favor, inicia sesión nuevamente.",
                CodigosError.AUTH_ERROR,
            )

    @staticmethod
    def _verificar_audiencia(decodificado: Dict[str, Any]) -> None:
        """
        Verifica el claim `aud` de los tokens sso_access.

        ⚠ Fail-open conocido: si SSO_SYSTEM_SLUG no está configurado, o si el
        token no trae `aud`, no se valida nada. Como todos los sistemas confían
        en la misma clave del IdP, un token emitido para otro sistema sería
        aceptado acá. Está pendiente cerrarlo (requiere que SSO_SYSTEM_SLUG sea
        obligatorio en todos los despliegues antes de fallar cerrado).
        """
        if decodificado.get('token_type') != 'sso_access':
            return

        aud = decodificado.get('aud')
        system_slug = config.system_slug()
        if aud and system_slug and aud != system_slug:
            raise error_auth(
                "Token no autorizado para este sistema.",
                CodigosError.TOKEN_WRONG_AUDIENCE,
            )

    @staticmethod
    def _reintentar_sin_firma_en_dev(token: str) -> Dict[str, Any]:
        """
        Bypass de verificación de firma — SOLO con JWT_SKIP_VERIFY_DEV=True
        y DEBUG=True. Fuera de eso, propaga el error como token inválido.
        """
        if not config.saltar_verificacion_dev():
            raise error_auth(
                "Token inválido. Por favor, inicia sesión nuevamente.",
                CodigosError.TOKEN_INVALID,
            )

        logger.warning(
            "[JWT] ⚠️  Firma inválida — decodificando SIN verificar "
            "(JWT_SKIP_VERIFY_DEV=True). SOLO para desarrollo."
        )
        try:
            return jwt.decode(
                token,
                options={'verify_signature': False, 'verify_exp': True},
                algorithms=['RS256'],
            )
        except Exception as e:
            logger.error("[JWT] Token malformado en modo dev: %s", e)
            raise error_auth(
                "Token inválido. Por favor, inicia sesión nuevamente.",
                CodigosError.TOKEN_INVALID,
            )

    # ───────────────────────────────────────────── extracción de datos

    @staticmethod
    def extraer_datos_usuario(token_decodificado: Dict[str, Any]) -> Dict[str, Any]:
        """Detecta el formato del token y extrae los datos del usuario."""
        if token_decodificado.get('token_type') == 'sso_access':
            return DecodificadorJWT._extraer_datos_sso_access(token_decodificado)
        return DecodificadorJWT._extraer_datos_legacy(token_decodificado)

    @staticmethod
    def _extraer_datos_sso_access(token: Dict[str, Any]) -> Dict[str, Any]:
        """Formato nuevo: campos en la raíz, permisos desde Redis local."""
        rol_id = token.get('rol_id', '')
        return {
            'id_usuario':          token.get('sub'),
            'nombre_usuario':      token.get('username'),
            'codigo_usuario':      token.get('cod_empleado'),
            'nombre':              token.get('full_name'),
            'apellido':            '',
            'correo':              token.get('email'),
            'unidad_codigo':       token.get('cod_unidad'),
            'cargo':               token.get('rol_slug', 'Funcionario'),
            'permisos':            DecodificadorJWT._extraer_permisos_redis(rol_id),
            'device_hash':         token.get('device_hash'),
            'profile_picture_url': token.get('profile_picture_url'),
            'rol_id':              rol_id,
        }

    @staticmethod
    def _extraer_datos_legacy(token: Dict[str, Any]) -> Dict[str, Any]:
        """Formato legacy: campos anidados en `usuario`, permisos en el token."""
        usuario = token.get('usuario', {})
        roles = usuario.get('roles', [])
        cargo_principal = roles[0].get('nombre', 'Funcionario') if roles else 'Funcionario'
        profile_picture = usuario.get('profile_picture')
        profile_picture_url = (
            profile_picture.get('url') if isinstance(profile_picture, dict) else None
        )
        return {
            'id_usuario':          token.get('user_id'),
            'nombre_usuario':      usuario.get('username'),
            'codigo_usuario':      usuario.get('codigo_administrativo'),
            'nombre':              usuario.get('nombre'),
            'apellido':            '',
            'correo':              usuario.get('correo'),
            'unidad_codigo':       usuario.get('codigo_unidad'),
            'cargo':               cargo_principal,
            'permisos':            DecodificadorJWT._extraer_permisos_legacy(usuario),
            'device_hash':         token.get('device_hash'),
            'profile_picture_url': profile_picture_url,
            'rol_id':              '',
        }

    # ────────────────────────────────────────────────────── permisos

    @staticmethod
    def _extraer_permisos_redis(rol_id: str) -> set:
        """
        Lee los permisos del rol desde Redis local (solo tokens sso_access).

        ⚠ Si Redis está caído devuelve un set vacío: el usuario queda sin
        ningún permiso. Fallar cerrado es lo correcto, pero desde afuera es
        indistinguible de "este rol no tiene permisos". Sigue pendiente
        diferenciarlo con un error explícito de estado no disponible.
        """
        if not rol_id:
            return set()
        try:
            from .state import get_local_perms
            permisos = get_local_perms(rol_id)
            return set(permisos) if permisos else set()
        except Exception as e:
            logger.warning("[JWT] No se pudieron leer permisos de Redis: %s", e)
            return set()

    @staticmethod
    def _extraer_permisos_legacy(usuario: Dict[str, Any]) -> set:
        """Permisos anidados en roles[].aplicaciones[].permisos[] del token."""
        nombres_app = config.nombres_app_legacy()
        permisos = set()
        for rol in usuario.get('roles', []):
            for aplicacion in rol.get('aplicaciones', []):
                if aplicacion.get('nombre', '') not in nombres_app:
                    continue
                for permiso in aplicacion.get('permisos', []):
                    codigo = permiso.get('codigo')
                    if codigo:
                        permisos.add(codigo)
        return permisos
