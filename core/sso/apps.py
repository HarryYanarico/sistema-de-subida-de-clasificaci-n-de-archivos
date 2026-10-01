"""
AppConfig del paquete SSO.

En `ready()` arranca el consumer AMQP como hilo daemon, pero solo cuando el
proceso es un servidor web. No debe arrancar en management commands (migrate,
shell, collectstatic) ni en procesos Celery: cada consumer extra compite por
los mensajes de la misma cola.
"""

import logging
import os
import sys

from django.apps import AppConfig

logger = logging.getLogger(__name__)


class SSOConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "core.sso"
    label = "sso"
    verbose_name = "UAGRM SSO"

    def ready(self):
        if self._debe_arrancar_consumer():
            self._arrancar_consumer()

    @staticmethod
    def _debe_arrancar_consumer() -> bool:
        """
        True solo si el proceso es un servidor web:
          · Producción (gunicorn/uvicorn): argv[0] no es manage.py ni celery.
          · Desarrollo (runserver): solo el proceso hijo (RUN_MAIN=true), para
            que el autoreloader no levante dos consumers.
          · Management commands y Celery: False.
        """
        argv0 = os.path.basename(sys.argv[0])

        if argv0 == "celery" or any("celery" in str(a) for a in sys.argv[:2]):
            return False

        if argv0 in ("manage.py", "django-admin"):
            comando = sys.argv[1] if len(sys.argv) > 1 else ""
            return comando == "runserver" and os.environ.get("RUN_MAIN") == "true"

        return True

    @staticmethod
    def _arrancar_consumer():
        from . import config

        if not config.amqp_url():
            logger.debug("SSOConfig: SSO_AMQP_URL vacía — consumer no iniciado.")
            return

        try:
            from .consumer import SSOEventConsumer
            SSOEventConsumer().start()
            logger.info("SSOConfig: SSOEventConsumer iniciado.")
        except Exception as exc:
            logger.warning("SSOConfig: no se pudo iniciar el consumer AMQP: %s", exc)
