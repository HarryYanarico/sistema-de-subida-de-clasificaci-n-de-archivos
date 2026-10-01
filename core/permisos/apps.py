"""
AppConfig del catálogo de permisos.

Con `PERMISSIONS_CONFIG['auto_generate'] = True` sincroniza el catálogo al
arrancar el servidor web.

⚠ Esa sincronización BORRA de la tabla los permisos que no estén en el
catálogo del código. Arrancar con un checkout desactualizado elimina permisos
en producción sin confirmación. El default es False; dejarlo así y sincronizar
explícitamente con `python manage.py generar_permisos` es lo recomendado.
"""

import logging
import sys

from django.apps import AppConfig
from django.conf import settings

logger = logging.getLogger(__name__)


class PermisosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.permisos'
    label = 'permisos'
    verbose_name = 'Catálogo de Permisos'

    def ready(self):
        config = getattr(settings, 'PERMISSIONS_CONFIG', {}) or {}
        if not config.get('auto_generate', False):
            return

        if not self._es_servidor_web():
            return

        if not self._tabla_existe():
            logger.debug("PermisosConfig: la tabla 'permisos' no existe todavía.")
            return

        try:
            from .services import PermisoService
            PermisoService.escanear_y_generar_permisos(verbose=False)
        except Exception as exc:
            logger.warning("PermisosConfig: no se pudo sincronizar el catálogo: %s", exc)

    @staticmethod
    def _es_servidor_web() -> bool:
        return 'runserver' in sys.argv or 'gunicorn' in sys.argv[0]

    @staticmethod
    def _tabla_existe() -> bool:
        """
        Comprueba la existencia de la tabla con la introspección de Django.

        Antes se hacía con un SELECT contra `information_schema`, que solo
        funciona en PostgreSQL y MySQL — en SQLite reventaba.
        """
        from django.db import connection
        from django.db.utils import OperationalError, ProgrammingError

        try:
            return 'permisos' in connection.introspection.table_names()
        except (OperationalError, ProgrammingError):
            return False
        except Exception:
            return False
