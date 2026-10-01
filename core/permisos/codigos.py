"""
Fuente única de verdad de los permisos del sistema.

Antes esto vivía partido: los códigos en `codigos.py` y sus metadatos en una
lista de tuplas dentro de `services.py`. Agregar un permiso obligaba a tocar
los dos archivos, y `Permisos.TODOS` se mantenía a mano — con lo cual podía
quedar desincronizado del catálogo sin que nada avisara.

Ahora el catálogo es la fuente y `TODOS` se deriva de él.

Para agregar un permiso:
  1. Agregar la constante en `Permisos`.
  2. Agregar su entrada en `CATALOGO`.
  3. Correr `python manage.py generar_permisos`.

Uso en resolvers — nunca escribir el string literal:

    from core.permisos import Permisos
    @RequierePermiso(Permisos.CONSULTAR_CONFIG)
"""

from typing import NamedTuple


class Permisos:
    """Códigos de permiso del sistema."""

    CONSULTAR_CONFIG    = "sistema_titulos_consultar_config"
    CONSULTAR_OPERATIVO = "sistema_titulos_consultar_operativo"
    CONSULTAR_INFORMIX  = "sistema_titulos_consultar_informix"
    IMPRIMIR            = "sistema_titulos_imprimir"
    CONFIG_DOCUMENTOS   = "sistema_titulos_config_documentos"
    CONFIG_CAMPOS       = "sistema_titulos_config_campos"
    CONFIG_FIRMAS       = "sistema_titulos_config_firmas"
    CONFIG_PLANTILLAS   = "sistema_titulos_config_plantillas"
    CONFIG_CATALOGOS    = "sistema_titulos_config_catalogos"
    ADMIN_USUARIOS      = "sistema_titulos_admin_usuarios"
    USUARIO_ACTUAL      = "sistema_titulos_usuario_actual"
    SUPLETORIOS         = "sistema_titulos_supletorios"

    # Se completa al final del módulo, derivado de CATALOGO.
    TODOS: frozenset = frozenset()


class DefinicionPermiso(NamedTuple):
    """Metadatos de un permiso, tal como se sincronizan a la base de datos."""

    codigo: str
    nombre: str
    descripcion: str
    recurso: str
    operacion: str


_RECURSO = "titulos"


CATALOGO: tuple[DefinicionPermiso, ...] = (
    DefinicionPermiso(
        Permisos.CONSULTAR_CONFIG,
        "Consultar configuración",
        "Permite leer tipos de documento, cargos, campos, firmas, coordenadas, "
        "plantillas, calibración, reverso y áreas de bachiller.",
        _RECURSO, "consultar_config",
    ),
    DefinicionPermiso(
        Permisos.CONSULTAR_OPERATIVO,
        "Consultar operativo",
        "Permite leer documentos activos, log de impresiones e historial de impresiones.",
        _RECURSO, "consultar_operativo",
    ),
    DefinicionPermiso(
        Permisos.CONSULTAR_INFORMIX,
        "Consultar Informix",
        "Permite ejecutar todas las queries de lectura sobre Informix: "
        "titulados, trámites, materias, facultades y entidades académicas.",
        _RECURSO, "consultar_informix",
    ),
    DefinicionPermiso(
        Permisos.IMPRIMIR,
        "Imprimir y generar documentos",
        "Permite generar PDFs, registrar impresiones, registrar QR y grabar "
        "impresiones en Informix.",
        _RECURSO, "imprimir",
    ),
    DefinicionPermiso(
        Permisos.CONFIG_DOCUMENTOS,
        "Configurar documentos",
        "Permite crear, actualizar y eliminar documentos, tipos de documento "
        "y unidades/programas (est_prog).",
        _RECURSO, "config_documentos",
    ),
    DefinicionPermiso(
        Permisos.CONFIG_CAMPOS,
        "Configurar campos",
        "Permite crear y actualizar campos, asignar campos a documentos, "
        "gestionar coordenadas y subir imágenes de coordenadas.",
        _RECURSO, "config_campos",
    ),
    DefinicionPermiso(
        Permisos.CONFIG_FIRMAS,
        "Configurar firmas",
        "Permite crear, actualizar y subir imágenes de firmas, "
        "y asociar o desasociar firmas de documentos.",
        _RECURSO, "config_firmas",
    ),
    DefinicionPermiso(
        Permisos.CONFIG_PLANTILLAS,
        "Configurar plantillas",
        "Permite subir y reemplazar plantillas PDF, guardar calibración "
        "de impresora y actualizar la configuración del reverso.",
        _RECURSO, "config_plantillas",
    ),
    DefinicionPermiso(
        Permisos.CONFIG_CATALOGOS,
        "Configurar catálogos",
        "Permite crear y actualizar cargos y áreas de bachiller.",
        _RECURSO, "config_catalogos",
    ),
    DefinicionPermiso(
        Permisos.ADMIN_USUARIOS,
        "Administrar usuarios",
        "Permite crear usuarios y cambiar el rol asignado a un usuario.",
        _RECURSO, "admin_usuarios",
    ),
    DefinicionPermiso(
        Permisos.USUARIO_ACTUAL,
        "Ver usuario actual",
        "Permite obtener la información del usuario autenticado (self-service).",
        _RECURSO, "usuario_actual",
    ),
    DefinicionPermiso(
        Permisos.SUPLETORIOS,
        "Módulo Supletorios",
        "Permite acceder al módulo de títulos supletorios: buscar por CI, "
        "crear solicitudes y generar documentos supletorios.",
        _RECURSO, "supletorios",
    ),
)


# Derivado del catálogo: imposible que quede desincronizado.
Permisos.TODOS = frozenset(definicion.codigo for definicion in CATALOGO)
