"""
Serialización genérica de kwargs de resolvers e instancias de modelos.

No conoce ningún modelo concreto: usa introspección de Django (`_meta`) y duck
typing. Convierte a primitivas JSON-safe todo lo que le llegue.

Archivos subidos: solo se guarda metadata ({nombre, tamaño, tipo}). Nunca se
toca el contenido binario.
"""

import os
import uuid
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

_LIMITE_PROFUNDIDAD = 10


# ────────────────────────────────────────────── instancias de modelos

def instancia_a_dict(instance) -> dict:
    """
    Convierte una instancia de modelo Django a un dict plano JSON-safe.

    Si la introspección de `_meta` falla (objeto que no es un modelo), cae a
    los atributos públicos de `__dict__`.
    """
    try:
        return {
            field.name: _serializar_valor(getattr(instance, field.name, None), field)
            for field in instance._meta.fields
        }
    except Exception:
        return {
            k: _serializar_valor(v)
            for k, v in instance.__dict__.items()
            if not k.startswith('_')
        }


def _serializar_valor(valor: Any, field=None) -> Any:
    """Convierte el valor de un campo de modelo a un tipo serializable."""
    if valor is None:
        return None

    if isinstance(valor, (bool, int, float, str)):
        return valor

    if isinstance(valor, (datetime, date, time)):
        return valor.isoformat()

    if isinstance(valor, Decimal):
        return float(valor)

    if isinstance(valor, uuid.UUID):
        return str(valor)

    # FileField ya guardado → ruta relativa
    try:
        from django.db.models.fields.files import FieldFile
        if isinstance(valor, FieldFile):
            return valor.name or None
    except ImportError:
        pass

    # ForeignKey.
    # NOTA: devuelve la instancia relacionada, no su id — `getattr(obj, 'unidad')`
    # resuelve el objeto y dispara una query. Termina serializado por el
    # `default=str` de json.dumps, así que en la bitácora aparece como
    # "Unidad object (3)" en vez de 3. Corregirlo es usar `field.attname`
    # ('unidad_id'), pero cambia el contenido de los registros ya emitidos.
    if field is not None and getattr(field, 'related_model', None):
        return valor

    try:
        return str(valor)
    except Exception:
        return repr(valor)


# ──────────────────────────────────────────── kwargs de resolvers

def serializar_kwargs(kwargs: dict) -> dict:
    """
    Serializa los kwargs de entrada de un resolver GraphQL.

    Descarta `info`, `self` y los valores None. Genérico: no asume nombres
    de campo de ningún dominio.
    """
    return {
        key: _serializar_input(value)
        for key, value in kwargs.items()
        if key not in ('info', 'self') and value is not None
    }


def _es_archivo_upload(value: Any) -> bool:
    """Duck typing: tiene read(), name y size → es un archivo subido."""
    return (
        callable(getattr(value, 'read', None))
        and hasattr(value, 'name')
        and hasattr(value, 'size')
    )


def _serializar_archivo(value: Any) -> dict:
    """Metadata del archivo. Nunca toca el contenido binario."""
    nombre = getattr(value, 'name', None) or ''
    return {
        'nombre': os.path.basename(nombre) if nombre else '',
        'tamaño': getattr(value, 'size', None),
        'tipo':   getattr(value, 'content_type', None),
    }


def _serializar_input(value: Any, _profundidad: int = 0) -> Any:
    """
    Serializa un valor de entrada: primitivos, fechas, UUID, archivos, listas
    y objetos Input de Strawberry (vía `__dict__`).

    Lleva un tope de profundidad para que una estructura con referencias
    circulares no cuelgue el registro de la bitácora.
    """
    if value is None or _profundidad > _LIMITE_PROFUNDIDAD:
        return None

    if isinstance(value, (bool, int, float, str)):
        return value

    if _es_archivo_upload(value):
        return _serializar_archivo(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, uuid.UUID):
        return str(value)

    if isinstance(value, (list, tuple)):
        return [_serializar_input(item, _profundidad + 1) for item in value]

    if hasattr(value, '__dict__'):
        return {
            k: _serializar_input(v, _profundidad + 1)
            for k, v in value.__dict__.items()
            if not k.startswith('_') and v is not None
        }

    return str(value)
