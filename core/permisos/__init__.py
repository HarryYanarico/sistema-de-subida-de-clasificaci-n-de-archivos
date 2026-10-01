"""
Catálogo de permisos del sistema.

Publica hacia admincentral qué permisos existen, para que el administrador
pueda asignarlos a los roles. No participa de la autorización en runtime: eso
lo resuelve `core.sso` leyendo los permisos del rol desde Redis.

Instalación:
  1. Agregar 'core.permisos' a INSTALLED_APPS.
  2. python manage.py migrate permisos
  3. python manage.py generar_permisos

Uso — nunca escribir el string literal del permiso:

    from core.permisos import Permisos
    from core.sso import RequierePermiso

    @RequierePermiso(Permisos.IMPRIMIR)
    def imprimir(self, info): ...

El modelo NO se exporta acá a propósito, para no forzar la carga del ORM al
importar el paquete. Usar: `from core.permisos.models import Permiso`.
"""

__version__ = "2.0.0"

from .codigos import CATALOGO, DefinicionPermiso, Permisos

__all__ = ['Permisos', 'CATALOGO', 'DefinicionPermiso']
