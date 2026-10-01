import json
import os
import time
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.utils.dateparse import parse_datetime

from .base import MIME_PDF, ArchivoRemoto, ErrorArchivo, ErrorProveedor, ProveedorRemoto

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:
    service_account = None
    build = None

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CAMPOS_LISTADO = 'nextPageToken, files(id, name, size, mimeType, modifiedTime)'
MAX_INTENTOS = 4
ESTADOS_REINTENTABLES = (429, 500, 502, 503, 504)
ESTADOS_SIEMPRE_FATALES = (401, 403, 429)


def _cargar_credenciales(ref):
    if build is None:
        raise ErrorProveedor(
            'Faltan las dependencias de Google. Instala '
            'google-api-python-client y google-auth'
        )

    ref = (ref or getattr(settings, 'DRIVE_CREDENTIALS_PATH', '') or '').strip()
    if not ref:
        raise ErrorProveedor('El origen no tiene credencial_ref configurada')

    ruta = Path(ref)
    if ruta.is_file():
        try:
            return service_account.Credentials.from_service_account_file(
                str(ruta), scopes=SCOPES
            )
        except Exception as e:
            raise ErrorProveedor(f'La credencial "{ref}" no es un JSON válido: {e}')

    contenido = os.getenv(ref, '').strip()
    if contenido:
        try:
            return service_account.Credentials.from_service_account_info(
                json.loads(contenido), scopes=SCOPES
            )
        except Exception as e:
            raise ErrorProveedor(f'La variable de entorno "{ref}" no contiene un JSON válido: {e}')

    raise ErrorProveedor(
        f'No se encontró la credencial "{ref}" ni como archivo ni como variable de entorno'
    )


class GoogleDriveProveedor(ProveedorRemoto):
    tipo = 'google_drive'

    def __init__(self, origen):
        super().__init__(origen)
        self._cliente = None

    def _servicio(self):
        if self._cliente is None:
            if not (self.origen.identificador or '').strip():
                raise ErrorProveedor(
                    'El origen no tiene identificador. Configura la carpeta de Drive'
                )
            credenciales = _cargar_credenciales(self.origen.credencial_ref)
            try:
                self._cliente = build(
                    'drive', 'v3', credentials=credenciales, cache_discovery=False
                )
            except Exception as e:
                raise ErrorProveedor(f'No se pudo inicializar el cliente de Drive: {e}')
        return self._cliente

    def listar(self, desde=None, limite=None):
        servicio = self._servicio()

        consulta = f"'{self.origen.identificador}' in parents and trashed = false"
        if desde:
            borde = (desde - timedelta(seconds=1)).strftime('%Y-%m-%dT%H:%M:%S')
            consulta += f" and modifiedTime > '{borde}'"

        parametros = {
            'q': consulta,
            'fields': CAMPOS_LISTADO,
            'pageSize': 1000,
            'orderBy': 'modifiedTime',
            'includeItemsFromAllDrives': True,
            'supportsAllDrives': True,
        }
        if self.origen.drive_compartido:
            parametros['corpora'] = 'allDrives'

        archivos = []
        token = None
        while True:
            if token:
                parametros['pageToken'] = token
            respuesta = self._con_reintentos(lambda: servicio.files().list(**parametros))
            for crudo in respuesta.get('files', []):
                archivos.append(self._a_archivo(crudo))
                if limite and len(archivos) >= limite:
                    return archivos
            token = respuesta.get('nextPageToken')
            if not token:
                break
        return archivos

    def descargar(self, archivo):
        servicio = self._servicio()

        if archivo.es_pdf:
            fabricar = lambda: servicio.files().get_media(
                fileId=archivo.id, supportsAllDrives=True
            )
        elif archivo.es_google_nativo:
            fabricar = lambda: servicio.files().export_media(
                fileId=archivo.id, mimeType=MIME_PDF
            )
        else:
            raise ErrorArchivo(
                f'"{archivo.nombre}" no es un PDF ({archivo.mime or "sin tipo"})'
            )

        return self._con_reintentos(fabricar, fatal_por_defecto=False)

    def _con_reintentos(self, fabricar, fatal_por_defecto=True):
        for intento in range(MAX_INTENTOS):
            try:
                return fabricar().execute()
            except Exception as e:
                reintentable = self._estado(e) in ESTADOS_REINTENTABLES
                if reintentable and intento < MAX_INTENTOS - 1:
                    time.sleep(2 ** intento)
                    continue
                raise self._traducir(e, fatal_por_defecto) from e
        raise ErrorProveedor('Se agotaron los reintentos contra Google Drive')

    @staticmethod
    def _estado(e):
        return getattr(getattr(e, 'resp', None), 'status', None)

    def _traducir(self, e, fatal_por_defecto):
        estado = self._estado(e)

        if estado in ESTADOS_SIEMPRE_FATALES:
            if estado == 401:
                return ErrorProveedor(
                    'Google rechazó las credenciales (401). '
                    'Revisa el JSON de la cuenta de servicio'
                )
            if estado == 403:
                return ErrorProveedor(
                    'Google rechazó la petición (403). Verifica que la carpeta esté '
                    'compartida con la cuenta de servicio, o espera si se agotó la '
                    'cuota diaria de descarga'
                )
            return ErrorProveedor(
                'Se excedió el límite de peticiones de Google (429) tras varios reintentos'
            )

        if fatal_por_defecto or estado is None:
            return ErrorProveedor(f'Error de Google Drive ({estado}): {e}')

        if estado == 404:
            return ErrorArchivo('El archivo ya no existe en Drive (404)')
        return ErrorArchivo(f'No se pudo descargar el archivo ({estado}): {e}')

    @staticmethod
    def _a_archivo(crudo):
        tamano = crudo.get('size')
        try:
            tamano = int(tamano) if tamano else 0
        except (TypeError, ValueError):
            tamano = 0
        return ArchivoRemoto(
            id=crudo['id'],
            nombre=crudo.get('name') or crudo['id'],
            tamano=tamano,
            mime=crudo.get('mimeType', ''),
            modificado=parse_datetime(crudo.get('modifiedTime') or ''),
        )
