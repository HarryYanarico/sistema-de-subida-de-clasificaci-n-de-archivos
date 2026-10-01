"""
Publicación de eventos de auditoría a RabbitMQ.

Responsabilidades:
  · Extraer la IP real del cliente (soporta proxies y X-Forwarded-For)
  · Clasificar la operación como mutación o consulta
  · Publicar el evento a la cola de auditoría

Regla de oro: la bitácora NUNCA rompe el flujo principal. Cualquier fallo se
registra en el log y se descarta.

Ante un RabbitMQ caído
──────────────────────
Se reintenta con backoff exponencial: 30 s, 60 s, 120 s… hasta un tope de 5
minutos. En cuanto RabbitMQ vuelve, la bitácora se reactiva sola.

Antes había un booleano de proceso que se prendía al primer fallo y no se
apagaba nunca: un blip de red —o simplemente arrancar el backend antes de que
RabbitMQ terminara de levantar— dejaba la auditoría muerta hasta el próximo
redeploy, sin una sola línea de log. Para un sistema cuya razón de ser es la
trazabilidad, era el defecto más caro del paquete: silencioso, de causa
cotidiana, y con pérdida irrecuperable (los eventos no publicados no existen
en ningún otro lado).

La caída ahora es visible:
  · Cada reintento fallido loguea a WARNING, con cuánto lleva caída y cuántos
    eventos se descartaron. La cadencia la marca el backoff, así que no
    ensucia el log con una línea por request.
  · La recuperación también loguea, para tener la ventana completa.
  · `estado()` devuelve una instantánea para health checks y diagnóstico.

Sigue pendiente un fallback a disco: hoy, lo que no se publica se pierde.
"""

import logging
import re
import threading
import time
from datetime import datetime, timezone
from typing import Optional

from . import config

logger = logging.getLogger(__name__)

# Silenciar los logs internos de pika — son ruidosos cuando el host no existe
logging.getLogger("pika").setLevel(logging.CRITICAL)


# ─────────────────────────────────────────────── clasificación y request

# Verbos de escritura: si el nombre del resolver empieza con uno, es mutación.
_VERBOS_ESCRITURA = frozenset({
    'crear', 'create', 'agregar', 'add', 'registrar', 'register',
    'insertar', 'insert', 'guardar', 'save', 'actualizar', 'update',
    'editar', 'edit', 'modificar', 'modify', 'eliminar', 'delete',
    'borrar', 'remove', 'enviar', 'send', 'recibir', 'receive',
    'devolver', 'return', 'aprobar', 'approve', 'rechazar', 'reject',
    'finalizar', 'finish', 'asignar', 'assign', 'procesar', 'process',
    'distribuir', 'distribute', 'subir', 'upload', 'activar', 'activate',
    'desactivar', 'deactivate', 'cambiar', 'change', 'resetear', 'reset',
    'confirmar', 'confirm', 'token', 'admin', 'generar', 'generate',
})


def es_mutacion(nombre_funcion: str) -> bool:
    """True si el nombre del resolver denota una operación de escritura."""
    palabras = re.split(r'[_\s]+', nombre_funcion.lower())
    return bool(palabras) and palabras[0] in _VERBOS_ESCRITURA


def obtener_ip(request) -> Optional[str]:
    """IP real del cliente, resolviendo cabeceras de proxy."""
    if not request:
        return None

    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        ip = xff.split(',')[0].strip()
        if ip:
            return ip

    x_real = request.META.get('HTTP_X_REAL_IP')
    if x_real:
        return x_real.strip()

    return request.META.get('REMOTE_ADDR')


# ─────────────────────────────────────────────── conexión a RabbitMQ

# pika no es thread-safe: un canal por hilo.
_thread_local = threading.local()

_ESPERA_INICIAL = 30    # segundos hasta el primer reintento
_ESPERA_MAXIMA  = 300   # tope del backoff: 5 minutos

_MOTIVO_DESACTIVADA = "bitácora desactivada (sin AUDITORIA_RABBIT_URL)"
_MOTIVO_EN_ESPERA   = "esperando el próximo reintento"

# Estado compartido entre hilos. Siempre bajo `_estado_lock`.
_estado_lock     = threading.Lock()
_desactivada     = False   # sin URL configurada: decisión de config, no fallo
_proximo_intento = 0.0     # time.monotonic() a partir del cual se reintenta
_espera_actual   = _ESPERA_INICIAL
_caida_desde     = 0.0     # time.monotonic() del primer fallo de la racha
_descartados     = 0       # eventos perdidos desde que empezó la caída


def estado() -> dict:
    """
    Instantánea del estado de la bitácora. Para health checks y diagnóstico.

        python manage.py shell -c "
        from core.auditoria.services import estado; print(estado())"
    """
    with _estado_lock:
        ahora = time.monotonic()
        return {
            "operativa":              not _desactivada and _caida_desde == 0.0,
            "desactivada":            _desactivada,
            "caida_hace_s":           int(ahora - _caida_desde) if _caida_desde else 0,
            "eventos_descartados":    _descartados,
            "proximo_reintento_en_s": max(0, int(_proximo_intento - ahora)),
        }


def reiniciar_conexion() -> None:
    """
    Fuerza un reintento inmediato, sin esperar al backoff.

    Rara vez hace falta —la reconexión es automática— pero sirve para no
    esperar tras arreglar RabbitMQ, o para reactivar la bitácora después de
    corregir `AUDITORIA_RABBIT_URL` sin reiniciar el proceso.

    No toca el contador de eventos descartados ni el inicio de la caída: si el
    reintento forzado funciona, el mensaje de recuperación tiene que informar
    la pérdida completa. Sub-reportar cuántos registros de auditoría se
    perdieron sería peor que no informar nada.
    """
    global _desactivada, _proximo_intento, _espera_actual
    with _estado_lock:
        _desactivada     = False
        _proximo_intento = 0.0
        _espera_actual   = _ESPERA_INICIAL
    _thread_local.channel = None
    logger.info("[Bitácora] Reintento forzado — se intentará publicar en el próximo evento.")


def _reservar_intento() -> Optional[str]:
    """
    Decide si a este hilo le toca intentar conectar.

    Devuelve None si puede intentar —y en ese caso **reserva el turno**,
    corriendo la ventana— o el motivo por el que no corresponde.

    La reserva evita el thundering herd: cuando vence el backoff con varios
    hilos atendiendo requests, uno solo intenta y el resto sigue esperando,
    en vez de abrir N conexiones contra un RabbitMQ que probablemente siga
    caído. Con un host inalcanzable, cada intento cuesta el timeout del
    socket, así que la diferencia entre 1 y N es real.
    """
    global _descartados, _proximo_intento

    with _estado_lock:
        if _desactivada:
            return _MOTIVO_DESACTIVADA

        ahora = time.monotonic()
        if ahora < _proximo_intento:
            _descartados += 1
            return _MOTIVO_EN_ESPERA

        _proximo_intento = ahora + _espera_actual   # reserva el turno
        return None


def _desactivar() -> None:
    """Sin URL configurada: no es un fallo, no tiene sentido reintentar."""
    global _desactivada
    with _estado_lock:
        ya_estaba = _desactivada
        _desactivada = True
    if not ya_estaba:
        logger.info(
            "[Bitácora] AUDITORIA_RABBIT_URL no configurada — la bitácora remota "
            "queda desactivada. Configurala y llamá a reiniciar_conexion() para activarla."
        )


def _marcar_fallo(motivo: str) -> None:
    """Programa el próximo reintento y deja constancia de la caída."""
    global _proximo_intento, _espera_actual, _caida_desde

    with _estado_lock:
        ahora = time.monotonic()
        es_el_primero = _caida_desde == 0.0
        if es_el_primero:
            _caida_desde = ahora

        espera = _espera_actual
        _proximo_intento = ahora + espera
        _espera_actual = min(_espera_actual * 2, _ESPERA_MAXIMA)

        caida_hace = int(ahora - _caida_desde)
        descartados = _descartados

    if es_el_primero:
        logger.warning(
            "[Bitácora] RabbitMQ no disponible (%s). Reintento en %s s. "
            "Los eventos de auditoría se pierden mientras tanto.",
            motivo, espera,
        )
    else:
        logger.warning(
            "[Bitácora] RabbitMQ sigue sin responder (%s). Caída hace %s s, "
            "%s eventos descartados. Próximo reintento en %s s.",
            motivo, caida_hace, descartados, espera,
        )


def _marcar_exito() -> None:
    """Conexión restablecida: libera la reserva e informa la ventana perdida."""
    global _proximo_intento, _espera_actual, _caida_desde, _descartados

    with _estado_lock:
        # Siempre, aunque no viniéramos de una caída: hay que liberar la
        # reserva que tomó `_reservar_intento`, o el resto de los hilos
        # quedaría esperando 30 s para usar una conexión que ya funciona.
        _proximo_intento = 0.0
        _espera_actual   = _ESPERA_INICIAL

        if _caida_desde == 0.0:
            return   # nunca estuvo caída: nada que reportar

        caida_hace  = int(time.monotonic() - _caida_desde)
        descartados = _descartados
        _caida_desde = 0.0
        _descartados = 0

    logger.warning(
        "[Bitácora] RabbitMQ recuperado tras %s s de caída. "
        "%s eventos de auditoría se perdieron en esa ventana.",
        caida_hace, descartados,
    )


def _obtener_canal_rabbit():
    """
    Canal pika del hilo actual, reutilizado si sigue abierto.

    Raises:
        RuntimeError: si la bitácora está desactivada, si estamos dentro de la
        ventana de backoff, o si la conexión falla.
    """
    # Un canal abierto es prueba de que la conexión funciona: usarlo aunque el
    # estado global diga que está caída (otro hilo pudo fallar por su cuenta).
    canal = getattr(_thread_local, 'channel', None)
    if canal is not None and canal.is_open:
        return canal

    motivo = _reservar_intento()
    if motivo:
        raise RuntimeError(motivo)

    import pika

    rabbit_url = config.rabbit_url()
    if not rabbit_url:
        _desactivar()
        raise RuntimeError(_MOTIVO_DESACTIVADA)

    try:
        parametros = pika.URLParameters(rabbit_url)
        parametros.heartbeat = 60
        parametros.blocked_connection_timeout = 5

        conexion = pika.BlockingConnection(parametros)
        _thread_local.channel = conexion.channel()
        _thread_local.channel.queue_declare(queue=config.rabbit_queue(), durable=True)
    except Exception as e:
        _thread_local.channel = None
        _marcar_fallo(str(e))
        raise RuntimeError(f"No se pudo conectar a RabbitMQ: {e}") from e

    _marcar_exito()
    return _thread_local.channel


# ─────────────────────────────────────────────── publicación

def registrar_en_bitacora(
    *,
    usuario_id: str,
    nombre: str,
    codigo_usuario: str,
    device_hash: str,
    ip: Optional[str],
    accion: str,
    tipo: str,
    detalles: dict,
    estado: str = 'exitoso',
    profile_picture_url: str = '',  # Compatibilidad: se acepta pero no se registra
) -> None:
    """
    Publica el evento a RabbitMQ. Silencioso ante errores.

    ⚠ `detalles` se serializa tal cual llega. No hay lista de campos a redactar,
    así que un resolver con contraseñas, tokens o datos sensibles en sus kwargs
    los envía en claro a la cola de auditoría. Pendiente agregar la redacción.
    """
    try:
        import json

        import pika

        payload = {
            'ip': ip,
            'usuario_id': str(usuario_id),
            'nombre': str(nombre),
            'codigo_usuario': str(codigo_usuario),
            'device_hash': str(device_hash),
            'sistema_origen': config.sistema_origen(),
            'accion': accion,
            'tipo': tipo,
            'detalles': detalles,
            'estado': estado,
            'fecha': datetime.now(timezone.utc).isoformat(),
        }

        canal = _obtener_canal_rabbit()
        canal.basic_publish(
            exchange='',
            routing_key=config.rabbit_queue(),
            body=json.dumps(
                {'pattern': 'bitacora.registrar', 'data': payload},
                ensure_ascii=False,
                default=str,
            ),
            properties=pika.BasicProperties(
                delivery_mode=2,
                content_type='application/json',
            ),
        )

    except RuntimeError as e:
        # A DEBUG a propósito: el estado de la caída ya se registró en
        # `_marcar_fallo`, con la cadencia del backoff. Loguear acá sería una
        # línea de WARNING por cada request mientras RabbitMQ esté caído.
        logger.debug("[Bitácora] Evento descartado: %s", e)

    except Exception as e:
        # El canal del hilo quedó inválido: descartarlo para que el próximo
        # intento abra una conexión nueva (y entre al backoff si sigue caído).
        _thread_local.channel = None
        logger.warning("[Bitácora] Error al publicar en RabbitMQ: %s", e)
