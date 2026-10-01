"""
Configuración del paquete de auditoría, en un solo lugar.

Settings que lee:

  AUDITORIA_RABBIT_URL       obligatorio — sin esto la bitácora queda apagada
  AUDITORIA_RABBIT_QUEUE     default 'auditoria_queue'
  AUDITORIA_SISTEMA_ORIGEN   nombre del sistema en los registros de auditoría
"""

from django.conf import settings


def _s(nombre: str, default=None):
    return getattr(settings, nombre, default)


def rabbit_url() -> str:
    """URL de RabbitMQ. Vacía → la bitácora remota queda desactivada."""
    return _s('AUDITORIA_RABBIT_URL', '') or ''


def rabbit_queue() -> str:
    return _s('AUDITORIA_RABBIT_QUEUE', 'auditoria_queue')


def sistema_origen() -> str:
    """Identifica al sistema emisor en cada registro de la bitácora."""
    return _s('AUDITORIA_SISTEMA_ORIGEN', 'sistema_desconocido')
