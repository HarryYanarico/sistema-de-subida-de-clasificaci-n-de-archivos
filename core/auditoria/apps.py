"""
AppConfig de la bitácora.

`ready()` no hace nada a propósito.

El paquete anterior conectaba señales `pre_save` / `pre_delete` a todos los
modelos de las apps listadas en `AUDITORIA_APPS_MODELOS`. Esas señales hacían
un SELECT extra por cada guardado y un SELECT completo por cada borrado para
guardar un snapshot del estado previo… que el decorador nunca leía: solo lo
borraba al empezar y al terminar. Era una query por escritura tirada a la
basura (500 queries extra en un bulk de 500 filas).

Por eso `signals.py` se eliminó y `AUDITORIA_APPS_MODELOS` ya no se lee.

⚠ Consecuencia: la bitácora NO registra el estado "antes/después" de una
edición ni el objeto eliminado, aunque la documentación de instalación lo
afirme. Nunca lo hizo. Implementarlo de verdad es leer el snapshot dentro del
decorador y agregarlo a `detalles` — trabajo aparte, no una regresión.
"""

from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core.auditoria'
    label = 'auditoria'
    verbose_name = 'Bitácora de Actividades'
