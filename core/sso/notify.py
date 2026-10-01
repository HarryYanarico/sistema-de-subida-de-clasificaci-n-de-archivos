"""
Puente entre el consumer AMQP y el stream SSE, vía Redis pub/sub.

El consumer corre en un hilo daemon; `SSOEventsView` corre en el hilo (o el
proceso) que atiende la conexión del navegador. No comparten memoria, así que
el consumer publica en un canal Redis y la vista lo consume.

Dos canales, con destinatarios distintos:

  sso:notify:rol:{rol_id}    cambios de permisos → afecta a todos los usuarios
                             que tengan ese rol
  sso:notify:user:{user_id}  revocación de sesión → afecta a una sola persona

Publicar es best-effort: si Redis no responde, el navegador no se entera en el
momento, pero el estado ya quedó guardado y lo detecta igual — por el chequeo
al conectar del SSE, o por `validar_estado_sso` en el próximo request.
"""

import logging

from . import config

logger = logging.getLogger(__name__)

_CHANNEL_ROL_PREFIX  = "sso:notify:rol"
_CHANNEL_USER_PREFIX = "sso:notify:user"

# Compatibilidad con versiones anteriores del paquete.
_CHANNEL_PREFIX = _CHANNEL_ROL_PREFIX

_DEDUP_TTL      = 2  # segundos — ventana de deduplicación entre workers
_SOCKET_TIMEOUT = 2


def canal_rol(rol_id: str) -> str:
    """Canal pub/sub de un rol. Única fuente del formato."""
    return f"{_CHANNEL_ROL_PREFIX}:{rol_id}"


def canal_usuario(user_id: str) -> str:
    """Canal pub/sub de un usuario. Única fuente del formato."""
    return f"{_CHANNEL_USER_PREFIX}:{user_id}"


def _publicar(canal: str, mensaje: str, clave_dedup: str, etiqueta: str) -> None:
    """
    Publica con deduplicación distribuida.

    Si varios workers reciben el mismo evento AMQP en ráfaga, solo el primero
    que gana el `SET NX` publica; los demás se descartan. El TTL de 2 s además
    agrupa eventos consecutivos del mismo destinatario en un solo PUBLISH.

    Falla en silencio: no poder notificar nunca debe romper el consumer.
    """
    try:
        import redis as _redis

        r = _redis.from_url(config.redis_url(), socket_timeout=_SOCKET_TIMEOUT)
        try:
            if r.set(clave_dedup, 1, nx=True, ex=_DEDUP_TTL):
                r.publish(canal, mensaje)
                logger.debug("sso.notify: publicado %s en %s", etiqueta, canal)
            else:
                logger.debug("sso.notify: deduplicado %s en %s", etiqueta, canal)
        finally:
            r.close()
    except Exception as exc:
        logger.warning("sso.notify: no se pudo publicar %s en %s: %s", etiqueta, canal, exc)


def publish_perm_change(rol_id: str) -> None:
    """Avisa que cambiaron los permisos de un rol."""
    if not rol_id:
        return
    _publicar(
        canal_rol(rol_id),
        "permission_change",
        f"sso:notify-sent:{rol_id}",
        "permission_change",
    )


def publish_session_revoked(user_id: str, motivo: str = "") -> None:
    """
    Avisa que la sesión de un usuario fue revocada, para expulsar su navegador.

    El `motivo` viaja como cuerpo del mensaje y llega al frontend dentro del
    evento SSE. La deduplicación hace que, cuando admincentral manda
    `device_revoked` y `session_revoked` casi a la vez, salga un solo PUBLISH:
    gana el primero, y el motivo del otro se pierde. No importa para el
    navegador —igual cierra sesión— y el motivo exacto queda en la marca de
    Redis, que es la que usa `validar_estado_sso` para el mensaje.
    """
    if not user_id:
        return
    _publicar(
        canal_usuario(user_id),
        motivo or "session_revoked",
        f"sso:notify-sent:user:{user_id}",
        "session_revoked",
    )
