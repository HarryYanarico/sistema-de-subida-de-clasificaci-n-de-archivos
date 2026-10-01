"""
Consumer AMQP de los eventos del IdP admincentral.

Hilo daemon que consume RabbitMQ y mantiene el Redis local sincronizado.

  Exchange: sso.events  (topic, durable)
  Cola:     sso.events.{SSO_SYSTEM_SLUG}  (durable)
  Routing:  #  (todos los eventos SSO)

Eventos:
  permission_change  → actualiza pv y permisos del rol, y notifica al SSE
  device_revoked     → actualiza dv del usuario y expulsa su navegador
  session_revoked    → marca la sesión como revocada y expulsa su navegador

Los dos eventos de revocación publican al canal del usuario. Admincentral los
manda juntos, así que la deduplicación de `notify` deja pasar un solo PUBLISH.

Sin SSO_AMQP_URL configurada el hilo duerme y no consume nada. Ante cualquier
excepción de red se reinicia solo a los 5 s.

⚠ DOS LIMITACIONES CONOCIDAS, no resueltas todavía:

1. Cola compartida entre réplicas. Todas las instancias del sistema (y cada
   worker de gunicorn) consumen de `sso.events.{slug}`. RabbitMQ entrega cada
   mensaje a UN solo consumidor, así que con N workers, N-1 no se enteran.
   Hoy no rompe porque el estado vive en un Redis compartido; rompería si el
   cache fuera local al proceso. Para fan-out real hace falta una cola
   exclusiva por instancia.

2. Mensaje envenenado. Ante cualquier error se hace reject(requeue=True), así
   que un mensaje que siempre falla (JSON malformado) se reencola en bucle y
   con prefetch=1 bloquea la cola entera. Falta una DLQ o un tope de reintentos.
"""

import json
import logging
import socket
import threading
import time

logger = logging.getLogger(__name__)

_REINTENTO_SEGUNDOS = 5
_ESPERA_SIN_CONFIG  = 60


class SSOEventConsumer(threading.Thread):
    """Daemon AMQP que mantiene el Redis local sincronizado con admincentral."""

    daemon = True
    name = "sso-event-consumer"

    def run(self):
        while True:
            try:
                self._consume_loop()
            except Exception as exc:
                logger.warning(
                    "SSOEventConsumer: error — reintentando en %s s: %s",
                    _REINTENTO_SEGUNDOS, exc,
                )
                time.sleep(_REINTENTO_SEGUNDOS)

    # ─────────────────────────────────────────────────────── conexión

    def _consume_loop(self):
        from kombu import Connection, Exchange, Queue

        from . import config

        amqp_url = config.amqp_url()
        if not amqp_url:
            logger.debug("SSOEventConsumer: SSO_AMQP_URL no configurada — inactivo.")
            time.sleep(_ESPERA_SIN_CONFIG)
            return

        system_slug = config.system_slug() or "sistema"
        exchange = Exchange("sso.events", type="topic", durable=True)
        queue = Queue(
            f"sso.events.{system_slug}",
            exchange=exchange,
            routing_key="#",
            durable=True,
        )

        with Connection(amqp_url, heartbeat=30) as conn:
            logger.info(
                "SSOEventConsumer: conectado — exchange=sso.events queue=sso.events.%s",
                system_slug,
            )
            with conn.Consumer(queues=[queue], callbacks=[self._handle], prefetch_count=1):
                while True:
                    try:
                        conn.drain_events(timeout=2)
                    except socket.timeout:
                        conn.heartbeat_check()

    # ───────────────────────────────────────────────────── despacho

    @classmethod
    def _handle(cls, body, message):
        try:
            if not isinstance(body, dict):
                body = json.loads(body)

            event_type = body.get("event_type", "")
            manejador = {
                "permission_change": cls._on_permission_change,
                "device_revoked":    cls._on_device_revoked,
                "session_revoked":   cls._on_session_revoked,
            }.get(event_type)

            if manejador:
                manejador(body)
            else:
                logger.debug("SSOConsumer: event_type desconocido ignorado: %s", event_type)

            message.ack()

        except Exception as exc:
            logger.error("SSOConsumer: error procesando mensaje — %s; body=%s", exc, body)
            message.reject(requeue=True)

    # ───────────────────────────────────────────────────── handlers

    @staticmethod
    def _on_permission_change(body: dict) -> None:
        from . import config
        from .state import set_local_perms, set_local_pv

        rol_id = str(body.get("rol_id", "")).strip()
        new_pv = body.get("new_pv")
        if not rol_id or new_pv is None:
            return

        set_local_pv(rol_id, int(new_pv))

        if "permissions_by_app" not in body:
            logger.info("SSOConsumer: pv actualizado — rol=%s pv=%s", rol_id, new_pv)
            return

        # El evento trae los permisos de todos los sistemas; nos quedamos
        # con los de este. Si el slug no aparece, el cambio no era para acá.
        system_slug = config.system_slug() or "sistema"
        perms = body["permissions_by_app"].get(system_slug, [])
        set_local_perms(rol_id, perms)

        from .notify import publish_perm_change
        publish_perm_change(rol_id)

        logger.info(
            "SSOConsumer: pv+perms actualizados — rol=%s pv=%s perms=%d",
            rol_id, new_pv, len(perms),
        )

    @staticmethod
    def _on_device_revoked(body: dict) -> None:
        """El dispositivo fue dado de baja: sube el dv y expulsa el navegador."""
        from .notify import publish_session_revoked
        from .state import set_local_dv

        user_id = str(body.get("user_id", "")).strip()
        new_dv = body.get("new_dv")
        if not user_id or new_dv is None:
            return

        set_local_dv(user_id, int(new_dv))
        publish_session_revoked(user_id, "device_revoked")
        logger.info("SSOConsumer: dv actualizado — user=%s dv=%s", user_id, new_dv)

    @staticmethod
    def _on_session_revoked(body: dict) -> None:
        """
        La sesión fue cerrada en admincentral: por un admin, por baja de
        contrato o por inactividad (`reason="idle"`).

        Deja la marca en Redis —que lee `validar_estado_sso` en el paso 0— y
        publica al canal del usuario para expulsar el navegador en el momento.
        Las dos cosas: el PUBLISH es best-effort y se pierde si el navegador
        está cerrado; la marca sobrevive y corta en el próximo request.
        """
        from .notify import publish_session_revoked
        from .state import marcar_sesion_revocada

        user_id = str(body.get("user_id", "")).strip()
        if not user_id:
            return

        motivo = str(body.get("reason", "")).strip()
        marcar_sesion_revocada(user_id, motivo)
        publish_session_revoked(user_id, motivo)
        logger.info("SSOConsumer: sesión revocada — user=%s motivo=%s", user_id, motivo or "-")
