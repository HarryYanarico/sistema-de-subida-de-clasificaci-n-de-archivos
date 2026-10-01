"""
Estado local de la sesión SSO, en Redis.

Guarda los contadores que admincentral emite en cada JWT, más los permisos
del rol:

  sso:pv:rol:{rol_id}     perms_version  — cambia al modificar permisos del rol
  sso:dv:user:{user_id}   device_version — cambia al revocar un dispositivo
  sso:perms:rol:{rol_id}  lista de códigos de permiso del rol

Se actualizan en tres momentos:
  · login    → SSOCallbackView siembra desde el JWT
  · refresh  → SSORefreshSessionView re-siembra tras renovar
  · evento   → SSOEventConsumer aplica lo que llega por AMQP

Cuando el valor local difiere del claim del JWT, `validar_estado_sso()` decide.
Con cache frío (Redis vacío o reiniciado) se siembra desde el JWT y se permite:
es un fail-open consciente y documentado — reiniciar Redis anula las
revocaciones pendientes.

Usa el cache de Django (CACHES['default']), no una conexión Redis propia.
Tiene que ser el mismo Redis que `config.redis_url()`, que es el que usan
notify.py y el stream SSE.
"""

import json
import logging

from django.core.cache import cache

from . import config

logger = logging.getLogger(__name__)

_PV_PREFIX      = "sso:pv:rol"
_DV_PREFIX      = "sso:dv:user"
_PERMS_PREFIX   = "sso:perms:rol"
_SESSION_PREFIX = "sso:session"

#: Valor guardado cuando la revocación no trae motivo. También es lo que
#: escribían las versiones anteriores del paquete (guardaban un 1).
_MOTIVO_POR_DEFECTO = "revocada"


def _pv_key(rol_id: str) -> str:
    return f"{_PV_PREFIX}:{rol_id}"


def _dv_key(user_id: str) -> str:
    return f"{_DV_PREFIX}:{user_id}"


def _perms_key(rol_id: str) -> str:
    return f"{_PERMS_PREFIX}:{rol_id}"


def _revocada_key(user_id: str) -> str:
    return f"{_SESSION_PREFIX}:{user_id}:revoked"


def _guardar(key: str, valor, etiqueta: str) -> None:
    """Escritura tolerante a fallos: Redis caído no debe tumbar el request."""
    try:
        cache.set(key, valor, config.ttl_estado())
        logger.debug("sso.state: %s actualizado (%s)", etiqueta, key)
    except Exception as exc:
        logger.warning("sso.state: no se pudo escribir %s: %s", key, exc)


# ────────────────────────────────────────────────────────── lectura

def get_local_pv(rol_id: str) -> int | None:
    val = cache.get(_pv_key(rol_id))
    return int(val) if val is not None else None


def get_local_dv(user_id: str) -> int | None:
    val = cache.get(_dv_key(user_id))
    return int(val) if val is not None else None


def get_local_perms(rol_id: str) -> list | None:
    """Lista de permisos del rol, o None si no hay nada cacheado."""
    val = cache.get(_perms_key(rol_id))
    if val is None:
        return None
    try:
        return json.loads(val)
    except (ValueError, TypeError):
        return None


def check_perm(rol_id: str, codigo: str) -> bool:
    """True si el rol tiene ese permiso según el estado local."""
    perms = get_local_perms(rol_id)
    return bool(perms) and codigo in perms


# ────────────────────────────────────────────────────────── escritura

def set_local_pv(rol_id: str, pv: int) -> None:
    if rol_id:
        _guardar(_pv_key(rol_id), pv, "pv")


def set_local_dv(user_id: str, dv: int) -> None:
    if user_id:
        _guardar(_dv_key(user_id), dv, "dv")


def set_local_perms(rol_id: str, perms: list) -> None:
    if rol_id:
        _guardar(_perms_key(rol_id), json.dumps(perms), "perms")


# ──────────────────────────────────────────── revocación de sesión

def marcar_sesion_revocada(user_id: str, motivo: str = "") -> None:
    """
    Marca la sesión del usuario como revocada.

    La lee `validar_estado_sso` en cada request y el stream SSE al conectarse.
    Se borra sola cuando el usuario vuelve a entrar (ver `seed_from_jwt`).
    """
    if not user_id:
        return
    try:
        cache.set(
            _revocada_key(user_id),
            motivo or _MOTIVO_POR_DEFECTO,
            config.ttl_revocacion(),
        )
        logger.info("sso.state: sesión marcada como revocada user=%s motivo=%s",
                    user_id, motivo or _MOTIVO_POR_DEFECTO)
    except Exception as exc:
        logger.warning("sso.state: no se pudo marcar la revocación user=%s: %s", user_id, exc)


def motivo_revocacion(user_id: str) -> str | None:
    """
    Motivo por el que la sesión está revocada, o None si está limpia.

    ⚠ Si Redis no responde devuelve None y el request pasa. Es el mismo
    fail-open que el resto del estado local: sin Redis no hay forma de saber
    si la sesión fue revocada, y bloquear a todos los usuarios ante un blip
    de red sería peor. Queda registrado en el log.
    """
    if not user_id:
        return None
    try:
        valor = cache.get(_revocada_key(user_id))
    except Exception as exc:
        logger.warning("sso.state: no se pudo leer la revocación user=%s: %s", user_id, exc)
        return None

    if valor is None:
        return None
    # Las versiones viejas guardaban un 1 sin motivo.
    return str(valor) if not isinstance(valor, int) else _MOTIVO_POR_DEFECTO


def sesion_revocada(user_id: str) -> bool:
    """True si la sesión del usuario está marcada como revocada."""
    return motivo_revocacion(user_id) is not None


def limpiar_revocacion(user_id: str) -> None:
    """
    Borra la marca de revocación.

    Es la contraparte imprescindible de `marcar_sesion_revocada`. Sin esto, un
    usuario legítimamente re-logueado seguiría rechazado hasta que expire el
    TTL — 24 h de bloqueo por una revocación ya resuelta.
    """
    if not user_id:
        return
    try:
        cache.delete(_revocada_key(user_id))
    except Exception as exc:
        logger.warning("sso.state: no se pudo limpiar la revocación user=%s: %s", user_id, exc)


def seed_from_jwt(token_payload: dict, permissions: list | None = None) -> None:
    """
    Siembra pv, dv y permisos desde un token recién emitido por el IdP.
    Llamado en el callback y en cada refresh.

    `permissions=None` significa "el IdP no mandó la clave": en ese caso no se
    toca el caché existente, en vez de pisarlo con una lista vacía.

    También **borra la marca de revocación**. Solo se llega acá después de que
    el IdP entregó tokens nuevos, y el IdP no los entrega si la sesión sigue
    revocada: que estemos acá significa que la revocación quedó atrás. Sin
    esta limpieza, el paso 0 de `validar_estado_sso` seguiría rechazando al
    usuario recién logueado hasta que expirara el TTL de 24 h.
    """
    rol_id  = token_payload.get("rol_id", "")
    user_id = token_payload.get("sub", "")
    pv      = token_payload.get("pv")
    dv      = token_payload.get("dv")

    if rol_id and pv is not None:
        set_local_pv(rol_id, int(pv))
    if user_id and dv is not None:
        set_local_dv(user_id, int(dv))
    if rol_id and permissions is not None:
        set_local_perms(rol_id, permissions)
    if user_id:
        limpiar_revocacion(user_id)
