"""
Sincronización del catálogo de permisos con la base de datos.

El catálogo (fuente de verdad) vive en `codigos.py`. Acá solo está la lógica
que lo baja a la tabla `permisos`.

Nota sobre el rol de esta tabla: NO se consulta para autorizar. En runtime los
permisos del usuario salen de Redis (tokens sso_access) o del propio token
(legacy). Esta tabla es el catálogo que el sistema publica hacia admincentral,
para que el administrador pueda asignar permisos a los roles.
"""

import logging

from .codigos import CATALOGO
from .models import Permiso

logger = logging.getLogger(__name__)


class PermisoService:
    """Sincroniza el catálogo de permisos del sistema con la base de datos."""

    @staticmethod
    def escanear_y_generar_permisos(verbose: bool = True, eliminar_obsoletos: bool = True):
        """
        Crea o actualiza los permisos de `CATALOGO`.

        ⚠ Con `eliminar_obsoletos=True` (default) BORRA de la tabla todo permiso
        que no esté en el catálogo. Si el código está desactualizado respecto a
        la base, esto elimina permisos en producción sin confirmación. Pasar
        False para una pasada segura que solo agrega y actualiza.

        Returns:
            dict con los contadores de la corrida.
        """
        registrar = _impresor(verbose)

        registrar("\n📋 Sincronizando permisos del sistema...\n")

        creados = actualizados = eliminados = 0

        for definicion in CATALOGO:
            try:
                _, created = Permiso.objects.update_or_create(
                    codigo=definicion.codigo,
                    defaults={
                        "nombre":      definicion.nombre,
                        "descripcion": definicion.descripcion,
                        "recurso":     definicion.recurso,
                        "operacion":   definicion.operacion,
                        "activo":      True,
                    },
                )
                if created:
                    creados += 1
                    registrar(f"  ✓ Creado:      {definicion.codigo}")
                else:
                    actualizados += 1
                    registrar(f"  ↻ Actualizado: {definicion.codigo}")
            except Exception as e:
                logger.warning("No se pudo sincronizar el permiso %s: %s", definicion.codigo, e)
                registrar(f"  ✗ Error en {definicion.codigo}: {e}")

        if eliminar_obsoletos:
            registrar("\n🧹 Limpiando permisos obsoletos...")
            codigos_activos = {definicion.codigo for definicion in CATALOGO}
            for permiso in Permiso.objects.exclude(codigo__in=codigos_activos):
                registrar(f"  🗑️  Eliminado: {permiso.codigo}")
                permiso.delete()
                eliminados += 1

        registrar(
            f"\n✅ Proceso completado:"
            f"\n   • {creados} permisos creados"
            f"\n   • {actualizados} permisos actualizados"
            f"\n   • {eliminados} permisos eliminados\n"
        )

        return {
            "creados": creados,
            "actualizados": actualizados,
            "eliminados": eliminados,
        }


def _impresor(verbose: bool):
    """Devuelve una función que imprime solo si verbose está activo."""
    if verbose:
        return print
    return lambda *_args, **_kwargs: None
