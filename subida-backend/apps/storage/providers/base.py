from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

MIME_PDF = 'application/pdf'
MIME_GOOGLE_NATIVO = (
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing',
)


class ErrorProveedor(Exception):
    """Fallo de credenciales, cuota o configuración. Aborta el lote completo."""


class ErrorArchivo(Exception):
    """Fallo aislado de un archivo. Se registra y se continúa con el resto."""


@dataclass
class ArchivoRemoto:
    id: str
    nombre: str
    tamano: int = 0
    mime: str = ''
    modificado: Optional[datetime] = None
    extra: dict = field(default_factory=dict)

    @property
    def es_pdf(self) -> bool:
        return self.mime == MIME_PDF

    @property
    def es_google_nativo(self) -> bool:
        return self.mime in MIME_GOOGLE_NATIVO

    @property
    def importable(self) -> bool:
        return self.es_pdf or self.es_google_nativo


class ProveedorRemoto(ABC):
    tipo = ''

    def __init__(self, origen):
        self.origen = origen

    @abstractmethod
    def listar(self, desde: Optional[datetime] = None,
               limite: Optional[int] = None) -> list[ArchivoRemoto]:
        raise NotImplementedError

    @abstractmethod
    def descargar(self, archivo: ArchivoRemoto) -> bytes:
        raise NotImplementedError

    def verificar(self) -> tuple:
        try:
            archivos = self.listar(limite=1)
        except (ErrorProveedor, ErrorArchivo) as e:
            return False, str(e)
        except Exception as e:
            return False, f'Error inesperado: {e}'
        if not archivos:
            return True, 'Conexión correcta, pero no se ve ningún archivo en el origen'
        return True, f'Conexión correcta ({len(archivos)} archivo(s) visible(s))'
