# Añadir un proveedor de archivos remotos

El sistema admite varias fuentes de archivos por unidad. Google Drive es el
primero, pero el diseño no lo ata a ningún proveedor concreto.

## Dónde vive la lógica

```
apps/storage/
  providers/
    base.py            contrato: ArchivoRemoto, ProveedorRemoto, errores
    google_drive.py    implementación actual
    __init__.py        registro PROVEEDORES y obtener_proveedor()
  sincronizacion.py    orquestación, contadores, idempotencia
  ingesta.py           pipeline común con el upload manual
  management/commands/
    sincronizar_origenes.py    sincroniza una vez (manual o desde el bucle)
    sincronizar_periodico.py   bucle de sincronización automática
```

Un proveedor nuevo no necesita tocar nada de esta estructura: `sincronizacion.py`
llama a `obtener_proveedor(origen)` y todo lo demás ya existe.

## Los dos errores que hay que respetar

Esta distinción define el comportamiento de la corrida completa, así que es lo
más importante de esta guía.

**`ErrorProveedor`** — problema del origen, no de un archivo: credenciales
expiradas, sin cuota, carpeta inexistente, red caída. **Aborta la corrida
entera.** El origen queda en estado `fallida` y `marca_tiempo` no se toca, así
que la próxima pasada reintenta desde el mismo punto.

**`ErrorArchivo`** — problema de un archivo concreto: ya no existe, se
corrompió, excede un límite. Se registra en `detalle`, se cuenta en `errores` y
**la corrida continúa** con los demás.

Ejemplo: una credencial vencida debe ser `ErrorProveedor`. Un 404 al descargar
un archivo debe ser `ErrorArchivo`. Si te equivocas en esta decisión, o el
sistema se detiene por un archivo que no debería, o se traga el error de una
credencial rota y avanza la marca de tiempo perdiendo archivos.

## Implementar un proveedor

### 1. Subclase `ProveedorRemoto`

```python
from .base import ArchivoRemoto, ErrorArchivo, ErrorProveedor, ProveedorRemoto


class MiProveedor(ProveedorRemoto):
    tipo = 's3'

    def __init__(self, origen):
        super().__init__(origen)
        self._cliente = None

    def _servicio(self):
        # Construye el cliente una vez por corrida.
        # Cualquier fallo de conexión o credencial va aquí.
        if self._cliente is None:
            try:
                self._cliente = construir_cliente(self.origen.identificador)
            except Exception as e:
                raise ErrorProveedor(f'No se pudo conectar: {e}') from e
        return self._cliente

    def listar(self, desde=None, limite=None):
        servicio = self._servicio()
        archivos = []
        for crudo in servicio.listar(desde=desde):
            archivos.append(ArchivoRemoto(
                id=crudo['clave'],
                nombre=crudo['nombre'],
                tamano=crudo['tamano'],
                mime=crudo['tipo'],
                modificado=crudo['fecha'],
            ))
            if limite and len(archivos) >= limite:
                break
        return archivos

    def descargar(self, archivo):
        servicio = self._servicio()
        try:
            return servicio.get(archivo.id)
        except FileNotFoundError as e:
            raise ErrorArchivo(f'"{archivo.nombre}" ya no existe') from e
        except Exception as e:
            raise ErrorArchivo(f'No se pudo descargar: {e}') from e
```

### 2. Sobre `ArchivoRemoto`

| Campo | Qué es |
|---|---|
| `id` | Identificador estable en el proveedor. Debe ser único y no cambiar si se renombra el archivo. Es lo que se guarda en `Documento.origen_id`. |
| `nombre` | Nombre del archivo. De aquí se extrae el código de la persona. |
| `tamano` | Bytes. Se compara contra 50 MB antes de descargar. |
| `mime` | Tipo MIME. Define si el archivo es importable. |
| `modificado` | Fecha de última modificación. Alimenta la marca de tiempo. |

Si tu proveedor usa un MIME distinto a `application/pdf`, las propiedades
`es_pdf` e `importable` de `ArchivoRemoto` no te servirán tal cual. Dos
opciones: usar `application/pdf` en el campo `mime` tras validar el tipo real, o
extender `base.py` con un `es_importable()` que el orquestador pueda consultar.

### 3. Registrar en `PROVEEDORES`

```python
from .mi_proveedor import MiProveedor

PROVEEDORES = {
    'google_drive': GoogleDriveProveedor,
    's3': MiProveedor,
}
```

Con eso, `obtener_proveedor(origen)` ya lo encuentra. Agrega el valor a
`OrigenArchivos.TIPO_CHOICES` en `apps/documentos/models.py` y genera la
migración. Si el tipo ya está declarado en el modelo y la migración está
aplicada, no hay nada más que hacer ahí.

## Requisitos de una implementación correcta

**`listar` debe respetar `desde`.** Es lo que hace la sincronización incremental.
Si se ignora, cada pasada relee la carpeta entera (funciona, pero se vuelve
lento). Si se aplica mal y salta archivos, se pierden documentos.

**`listar` debe paginar.** `pageSize` de la API es un máximo por página, no un
total. Una carpeta con 1500 archivos devuelve varias páginas.

**`modificado` debe ser un `datetime` con zona horaria.** Es un pre-filtro: si
viene vacío, la marca de tiempo nunca avanza y cada corrida reprocesa todo.
El orquestador solo usa este valor para avanzar la marca, no para filtrar, así
que un valor ligeramente atrasado es seguro; uno adelantado hace que se pierdan
archivos.

**Los errores de descarga deben ser `ErrorArchivo`, no `ErrorProveedor`.** Ya
lo cubrimos arriba, pero es el error más común.

**No muevas ni borres nada en el origen.** El sistema es de solo lectura. Los
tipos `s3`, `onedrive` y `carpeta` están declarados en el modelo como
reservados, pero solo `google_drive` tiene implementación.

## Probar sin escribir en la base

```bash
python manage.py sincronizar_origenes --dry-run
```

No crea documentos, no crea filas de `Sincronizacion` y no avanza
`marca_tiempo`. Sirve para verificar credenciales, permisos de carpeta y
visibilidad de archivos antes de la corrida real.

Para probar la lógica de aíslamiento de errores, un doble con el contrato
`ProveedorRemoto` basta: no hace falta tocar la API real.

## Agregar la credencial

El patrón es el de `google_drive.py`: `credencial_ref` guarda una **referencia**,
nunca el secreto. La resolución acepta una ruta de archivo o el nombre de una
variable de entorno que contenga el JSON.

Si tu proveedor necesita más campos de conexión que una sola credencial, una
opción es codificarlos en el prefijo de `identificador` (por ejemplo
`bucket|prefijo`) o agregar columnas propias con una migración nueva. Evita
meter el secreto en `identificador`: ese campo se muestra en el admin y en los
endpoints de la API.
