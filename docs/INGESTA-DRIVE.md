# Ingesta desde Google Drive

El sistema puede leer archivos directamente de una carpeta de Google Drive,
procesarlos con el mismo pipeline que el upload manual, y guardarlos en MinIO.

El flujo es **pull**: el usuario externo sube a su carpeta de Drive y el sistema
va a buscar los archivos. No hay OAuth por usuario, ni selector de archivos, ni
acceso del navegador a Drive.

## Cómo funciona

```
Carpeta de Drive  ->  sincronizar_origenes  ->  PDFProcessor  ->  MinIO
                            |
                            +-> Documento.origen_id  (evita reimportar)
                            +-> Sincronizacion       (bitácora de la corrida)
```

Por cada archivo encontrado se aplica la misma validación del upload manual:
el nombre debe contener un código de persona de 5 o más dígitos, la `Persona`
debe existir en la unidad, y el PDF no puede superar 50 MB.

## Configuración de Google

### 1. Crear el proyecto y la cuenta de servicio

En https://console.cloud.google.com:

1. Crea un proyecto (o usa uno existente).
2. Activa la **Google Drive API**.
3. En *IAM y administración > Cuentas de servicio*, crea una cuenta de
   servicio sin rol de IAM. Se genera un email con la forma
   `NOMBRE@PROYECTO.iam.gserviceaccount.com`.
4. Crea una clave JSON y guárdala fuera del repositorio. Este archivo **nunca**
   se sube a git ni se guarda en la base de datos.

### 2. Compartir la carpeta

Comparte la carpeta de destino con la cuenta de servicio (permiso de lector).
Esto aplica tanto si el Drive es personal de un docente como si es un Drive
compartido de la unidad.

Si los archivos son de una unidad y se sube a **un Drive compartido**, marca
`drive_compartido` en el origen. Solo cambia la forma de la consulta, no el
resultado.

## Configurar el origen

Desde el admin de Django (*Orígenes de archivos*), crea un registro:

| Campo | Valor |
|---|---|
| `unidad` | La unidad que será propietaria de los documentos importados |
| `tipo` | `google_drive` |
| `identificador` | ID de la carpeta de Drive (el que aparece en la URL tras `/folders/`) |
| `drive_compartido` | `True` solo si la carpeta está en un Drive compartido |
| `credencial_ref` | Ruta del JSON de credenciales, o nombre de una variable de entorno |
| `activo` | `True` para incluirlo en la sincronización automática |

`credencial_ref` acepta dos formas:

- **Ruta**: `/run/secrets/drive.json`. Requiere montar el archivo en el
  contenedor.
- **Variable de entorno**: el nombre de una variable (por ejemplo
  `DRIVE_CREDENTIALS`) cuyo valor sea el JSON completo de la credencial.

En ambos casos la clave privada vive fuera de la base de datos. La columna solo
guarda la referencia.

Si `credencial_ref` está vacío, el sistema usa `DRIVE_CREDENTIALS_PATH` del
entorno como valor por defecto.

## Probar antes de sincronizar

```bash
cd subida-backend
python manage.py sincronizar_origenes --dry-run
```

No escribe nada: ni documentos, ni filas de `Sincronizacion`, ni avanza la marca
de tiempo. Muestra qué se encontraría, qué se omitiría y la marca propuesta.

Un resultado típico antes de arreglar nada:

```
Modo simulación: no se escribe nada.
Sincronizando 1 origen(es) con límite=sin límite
  con_errores origen 1 (unidad 1, google_drive): 0 procesado(s), 0 página(s), 0 ya importado(s), 0 error(es)
      - 98765432.pdf: no existe una Persona con el código 98765432
```

## Sincronización manual

```bash
# Todos los orígenes activos
python manage.py sincronizar_origenes

# Solo una unidad
python manage.py sincronizar_origenes --unidad 3

# Un origen puntual, con tope de archivos
python manage.py sincronizar_origenes --unidad 3 --origen 7 --limit 50

# Simulación de un origen concreto
python manage.py sincronizar_origenes --unidad 3 --origen 7 --dry-run
```

Agrega `--inactivo` para incluir orígenes marcados como inactivos.

El comando sale con código de error si algún origen falla, útil para
integrarlo con un monitor externo.

## Sincronización automática

El comando `synchronizar_periodico` corre `sincronizar_origenes` en bucle cada
`SYNC_INTERVAL_MINUTOS` minutos. El valor se lee al arrancar, así que cambiarlo
exige reiniciar el servicio:

```bash
# en subida-arquitectura/.env
SYNC_INTERVAL_MINUTOS=240
```

```bash
cd subida-arquitectura
docker compose up -d --force-recreate scheduler
```

El servicio `scheduler` de `docker-compose.yml` lo invoca en un contenedor
aparte. Puedes levantarlo sin Docker:

```bash
python manage.py sincronizar_periodico                 # bucle
python manage.py sincronizar_periodico --once          # un ciclo y sale
python manage.py sincronizar_periodico --intervalo 15  #Override del entorno
```

`--once` es lo que conviene para un cron del sistema o una tarea programada
externa, si prefieres no dejar un proceso vivo.

Para dejar solo la sincronización manual, comenta el bloque `scheduler` en
`docker-compose.yml` y recrea el stack con `docker compose up -d`.

El servicio aplica las migraciones antes del primer ciclo, así que es seguro
levantarlo en una instalación nueva. Responde a `SIGTERM` y `SIGINT`, de modo
que `docker compose stop` no lo corta a mitad de una descarga. Si un ciclo
falla, registra el traceback y sigue; el reintento llega en la siguiente vuelta.

Los logs quedan en `docker compose logs -f scheduler`.

### Detalle del contenedor

El `command` del servicio termina en `exec`:

```yaml
command: sh -c "python manage.py migrate --noinput &&
               exec python manage.py sincronizar_periodico"
```

Sin ese `exec`, `sh` queda como PID 1 y no reenvía `SIGTERM` a Python. El
contenedor ignora la señal, espera todo el timeout de `docker compose stop` y
termina con `Exited (137)`, es decir, por `SIGKILL`. Con `exec`, Python
ocupa el PID 1, recibe la señal y sale limpio con `Exited (0)`.

## Endpoints HTTP

Útiles para un botón en el frontend o para integraciones.

```bash
# Listar orígenes configurados
GET /api/origenes/?unidad_id=3

# Sincronizar un origen
POST /api/origenes/sync/
     origen_id=7
     dry_run=1        # opcional
     limit=50         # opcional

# Historial de corridas
GET /api/sincronizaciones/?origen_id=7&limit=20
```

`POST` responde `200` con `success: true` para `exitosa` y `con_errores`, y
`502` cuando el origen falló por credenciales o cuota.

## Idempotencia y reintentos

Cada archivo se guarda en `Documento.origen_id` con el ID que usa Drive. Antes
de procesar, el sistema consulta si ya existe ese `origen_id`; si existe, lo
cuenta como `omitidos_ya_importados` y lo salta. Ejecutar la sincronización
dos veces no duplica documentos.

Esto importa porque la marca de tiempo **no siempre avanza**. Solo avanza si
todos los archivos de la corrida se procesaron o ya estaban importados. Si
queda alguno pendiente (código inválido, `Persona` inexistente, archivo muy
grande, error de descarga), la marca se mantiene y la próxima corrida vuelve a
mirar esa carpeta. Esto evita que un archivo problemático quede invisible para
siempre, a costa de releer la carpeta en cada pasada.

Por eso conviene corregir los errores de la corrida anterior antes de esperar
la automática: mientras haya pendientes, el sistema reintenta.

## Contadores de la corrida

Cada ejecución guarda una fila en `Sincronizacion`:

| Campo | Significado |
|---|---|
| `encontrada` | Archivos devueltos por el proveedor |
| `procesados` | Archivos importados con éxito |
| `omitidos_ya_importados` | Ya estaban en la base (idempotencia) |
| `omitidos_sin_codigo` | El nombre no tiene un código de 5+ dígitos |
| `omitidos_sin_persona` | Tiene código, pero no existe la `Persona` en la unidad |
| `omitidos_tamano` | Supera 50 MB |
| `omitidos_no_pdf` | No es un PDF ni un documento nativo de Google |
| `paginas` | Páginas totales generadas |
| `errores` | Fallos durante el procesamiento |

El campo `detalle` guarda, hasta 500 entradas, archivo por archivo el motivo de
cada omisión o error. Es la forma rápida de saber qué corregir.

## Errores frecuentes

**`Google rechazó las credenciales (401)`**
La clave JSON no corresponde a la cuenta de servicio, o está corrupta. Confirma
la ruta en `credencial_ref` y que el archivo sea el JSON de clave privada.

**`Google rechazó la petición (403)`**
Dos causas probables: la carpeta no está compartida con la cuenta de servicio,
o se agotó la cuota diaria de la API. La cuota se reinicia cada 24 horas;
la alternativa es pedir cuota adicional en la consola de Google.

**`La variable de entorno "X" no contiene un JSON válido`**
`credencial_ref` apunta a una variable que existe pero no contiene el JSON de
la credencial.

**`No se encontró la credencial "X" ni como archivo ni como variable de entorno`**
La ruta no existe en el sistema donde corre Django. En Docker, una ruta del
host no existe dentro del contenedor: hay que montar el archivo como volumen.

**`El tipo de origen "onedrive" todavía no está implementado`**
Los tipos `s3`, `onedrive` y `carpeta` existen en el modelo pero no tienen
proveedor. Ver `PROVEEDORES.md`.

## Límites conocidos

- Solo se leen archivos que estén **directamente** en la carpeta indicada, no
  subcarpetas.
- La marca de tiempo se basa en `modifiedTime` de Drive, no en un cambio de
  contenido: editar un archivo ya importado dentro de la ventana de la marca no
  genera un documento nuevo. Para reimportar un archivo corregido, bórralo de
  la tabla `documentos` y limpia `marca_tiempo` del origen.
- No se mueven ni borran archivos en Drive. La sincronización es de solo
  lectura.
- Los documentos nativos de Google (Docs, Sheets, Slides, Drawings) se exportan
  a PDF en el momento de la descarga.
- El límite de 50 MB por archivo se comprueba con el tamaño que reporta Drive,
  antes de descargar.
