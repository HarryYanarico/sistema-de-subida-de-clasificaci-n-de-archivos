"""
Bitácora de actividad — publica los eventos de auditoría a RabbitMQ.

Se llamaba `core.bitacora`. El nombre nuevo es coherente con los settings que
ya usaba (`AUDITORIA_RABBIT_URL`, `AUDITORIA_SISTEMA_ORIGEN`).

Instalación:
  1. pip install pika
  2. Agregar 'core.auditoria' a INSTALLED_APPS.
  3. Configurar AUDITORIA_RABBIT_URL y AUDITORIA_SISTEMA_ORIGEN.

Uso:

    from core.auditoria import RegistrarActividad

    @strawberry.mutation
    @RequiereAutenticacion
    @RequierePermiso(Permisos.IMPRIMIR)
    @RegistrarActividad("impresion de titulo")     # ← siempre el más interno
    def imprimir(self, info, ...): ...

No tiene modelos ni migraciones: solo publica a la cola. Quien persiste los
registros es el sistema de auditoría centralizado.

Si RabbitMQ se cae, la bitácora reintenta sola con backoff (30 s → 5 min) y se
reactiva en cuanto vuelve. Para ver cómo está:

    from core.auditoria import estado
    estado()   # {'operativa': True, 'eventos_descartados': 0, ...}
"""

__version__ = "2.0.0"

from .decoradores import RegistrarActividad
from .services import estado, reiniciar_conexion

__all__ = ['RegistrarActividad', 'estado', 'reiniciar_conexion']
