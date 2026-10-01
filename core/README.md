# Paquetes core — estructura unificada

Cuatro paquetes pasaron a tres. `core/autenticacion` se fusionó dentro de
`core/uagrm_sso`, que ahora se llama `core/sso`.

```
core/                    ← namespace package: NO lleva __init__.py
├── sso/                 ← identidad: login, token, sesión, guards
├── permisos/            ← catálogo de permisos del sistema
└── auditoria/           ← bitácora de actividad
```

Dependencias, en una sola dirección y sin ciclos:

```
sso ──(perezosa, opcional)──> auditoria
permisos ──> (nada)
```

`sso` importa `auditoria` solo dentro de una función y con `except` mudo: el
SSO funciona sin la bitácora instalada, y un fallo de auditoría nunca puede
convertirse en un fallo de autenticación.

---

## 1. Por qué se fusionaron `autenticacion` y `uagrm_sso`

Eran dos paquetes que se importaban mutuamente por ruta absoluta:

```python
# core/autenticacion/jwt.py
from core.uagrm_sso.state import get_local_perms
# core/autenticacion/autenticacion.py
from core.uagrm_sso.validator import validar_estado_sso
```

Eso obligaba a que ambos vivieran exactamente en `core/`, y hacía imposible
usar uno sin el otro: sin `core/autenticacion`, nadie leía el estado que
`uagrm_sso` escribía en Redis — el fallo que documenta el manual de revocación
del 2026-07-09. Al unificarlos esos imports pasan a ser relativos (`.state`,
`.validator`) y el acoplamiento deja de ser un riesgo de despliegue.

---

## 2. Mapa de migración

### Módulos

| Antes | Ahora | Nota |
|---|---|---|
| `core/uagrm_sso/client.py` | `core/sso/client.py` | |
| `core/uagrm_sso/consumer.py` | `core/sso/consumer.py` | |
| `core/uagrm_sso/notify.py` | `core/sso/notify.py` | |
| `core/uagrm_sso/state.py` | `core/sso/state.py` | |
| `core/uagrm_sso/validator.py` | `core/sso/validator.py` | |
| `core/uagrm_sso/views.py` | `core/sso/views.py` | |
| `core/uagrm_sso/urls.py` | `core/sso/urls.py` | |
| `core/uagrm_sso/apps.py` | `core/sso/apps.py` | `name = "core.sso"` |
| `core/uagrm_sso/jwks.py` | **eliminado** | código muerto |
| `core/autenticacion/jwt.py` | `core/sso/tokens.py` | renombrado: ya no tapa a PyJWT |
| `core/autenticacion/estructura.py` | `core/sso/usuario.py` | |
| `core/autenticacion/autenticacion.py` | `core/sso/autenticacion.py` | + `GuardPermisos` |
| `core/autenticacion/permisos.py` | `core/sso/autenticacion.py` | fusionado |
| `core/autenticacion/decoradores.py` | `core/sso/guards.py` | |
| — | `core/sso/config.py` | **nuevo**: todos los settings |
| — | `core/sso/errores.py` | **nuevo**: códigos de `extensions.code` |
| `core/permissions/*` | `core/permisos/*` | |
| `core/permissions/decorators.py` | **eliminado** | `auto_permisos` no lo usaba nadie |
| — | `core/permisos/migrations/0001_initial.py` | **nuevo** |
| `core/bitacora/*` | `core/auditoria/*` | |
| `core/bitacora/decorators.py` | `core/auditoria/decoradores.py` | |
| `core/bitacora/signals.py` | **eliminado** | el snapshot nunca se leía |
| — | `core/auditoria/config.py` | **nuevo** |

### Imports en tu proyecto

```python
# ── antes ────────────────────────────────────────────────────────
from core.autenticacion import RequiereAutenticacion, RequierePermiso
from core.autenticacion.jwt import DecodificadorJWT
from core.uagrm_sso import validar_estado_sso, get_local_perms
from core.uagrm_sso.state import seed_from_jwt
from core.uagrm_sso.urls import urlpatterns as sso_urlpatterns
from core.permissions import Permisos
from core.permissions.models import Permiso
from core.bitacora import RegistrarActividad

# ── ahora ────────────────────────────────────────────────────────
from core.sso import RequiereAutenticacion, RequierePermiso
from core.sso import DecodificadorJWT                 # ya se exporta directo
from core.sso import validar_estado_sso, get_local_perms, seed_from_jwt
from core.sso.urls import urlpatterns as sso_urlpatterns
from core.permisos import Permisos
from core.permisos.models import Permiso
from core.auditoria import RegistrarActividad
```

### `INSTALLED_APPS`

```python
INSTALLED_APPS = [
    # ...
    "core.sso",         # antes "core.uagrm_sso"
    "core.permisos",    # antes "core.permissions"
    "core.auditoria",   # antes "core.bitacora"
]
```

`core/autenticacion` nunca estuvo en `INSTALLED_APPS` (no era una app Django):
simplemente desaparece como ruta de import.

### Base de datos

La tabla sigue llamándose `permisos` (`db_table` explícito), así que **no hay
cambio de esquema**. Pero el app label pasa de `permissions` a `permisos`. Si tu
proyecto ya tiene la tabla creada:

```bash
python manage.py migrate permisos --fake-initial
```

Si además tenías una migración generada localmente bajo el label `permissions`,
borrá su registro antes:

```bash
python manage.py shell -c "
from django.db.migrations.recorder import MigrationRecorder
MigrationRecorder.Migration.objects.filter(app='permissions').delete()"
```

---

## 3. Settings

Cada paquete declara los suyos en su `config.py`. Ese archivo es la respuesta
completa a "¿qué configura este paquete?".

### `core.sso` — `core/sso/config.py`

| Setting | Default | Para qué |
|---|---|---|
| `URL_API_SSO` | `http://admincentral-backend:8003` | URL del IdP |
| `SSO_API_KEY` | `""` | Header `API-Key` |
| `SSO_SYSTEM_KEY` | `""` | Clave del sistema (alias: `SSO_TRAMITES_SYSTEM_KEY`) |
| `SSO_SYSTEM_SLUG` | `""` | Cola AMQP y claim `aud` |
| `SSO_HTTP_TIMEOUT` | `10` | Timeout hacia el IdP |
| `SSO_USER_AGENT` | `{slug}-backend/1.0 (sso-client)` | UA ante el anti-bots |
| `JWT_LLAVE_PUBLICA` | `""` | Clave pública RSA |
| `JWT_SKIP_VERIFY_DEV` | `False` | Bypass de firma (exige `DEBUG=True`) |
| `SSO_COOKIE_SECURE` | `True` | Flag `Secure` |
| `SSO_COOKIE_SAMESITE` | `"Lax"` | |
| `SSO_COOKIE_HTTPONLY` | `False` | **nuevo** — ver abajo |
| `SSO_COOKIE_MAX_AGE` | `86400` | 24 h |
| `SSO_REDIS_URL` | cae a `REDIS_CACHE_URL` → `CACHES.default` | pub/sub del SSE |
| `SSO_AMQP_URL` | `""` | Vacía → consumer inactivo |
| `SSO_ESTADO_TTL` | 7 días | TTL de pv/dv/perms |
| `SSO_TTL_REVOCACION` | 24 h | TTL de la marca de sesión revocada |
| `SSO_APP_NAMES_LEGACY` | `{sistema-tramites, sistema-titulos, …}` | tokens legacy |

Dos settings merecen atención:

**`SSO_COOKIE_SECURE` y la variable `USE_HTTPS`.** Las guías de integración
documentan `USE_HTTPS` en el `.env`, pero el paquete nunca la leyó ni la lee.
Si tu proyecto la usa, hay que cablearla a mano:

```python
SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", "False") == "True"
```

Sin esa línea, `USE_HTTPS=False` no tiene ningún efecto: las cookies salen con
`Secure=True` y sobre HTTP el navegador las descarta en silencio. Es la causa
del clásico "Sesión Inválida" recién iniciada la sesión.

**`SSO_COOKIE_HTTPONLY` (nuevo).** El default `False` conserva el
comportamiento histórico: el access token es legible desde `document.cookie`,
o sea que cualquier XSS puede robarlo. Si tu frontend no necesita leer el JWT,
poner `True` cierra esa exposición sin tocar el paquete.

### `core.permisos`

| Setting | Default | Para qué |
|---|---|---|
| `PERMISSIONS_CONFIG['auto_generate']` | `False` | Sincronizar al arrancar |

⚠ Con `True`, el arranque **borra** de la tabla todo permiso que no esté en
`codigos.CATALOGO`. Un checkout desactualizado elimina permisos en producción.
Dejarlo en `False` y usar `python manage.py generar_permisos`.

### `core.auditoria`

| Setting | Default | Para qué |
|---|---|---|
| `AUDITORIA_RABBIT_URL` | `""` | Vacía → bitácora desactivada |
| `AUDITORIA_RABBIT_QUEUE` | `auditoria_queue` | |
| `AUDITORIA_SISTEMA_ORIGEN` | `sistema_desconocido` | Identifica al emisor |

`AUDITORIA_APPS_MODELOS` **ya no se lee** (ver §4).

---

## 4. Qué se eliminó y por qué

**`uagrm_sso/jwks.py`** — 50 líneas que resolvían la clave pública por `kid`
para soportar rotación sin downtime. Ningún módulo lo importaba: la
verificación siempre usó `JWT_LLAVE_PUBLICA` estática.

> Consecuencia en pie: cuando admincentral rote su clave RSA, todos los
> sistemas caen hasta que alguien edite el `.env` de cada uno. Conectarlo de
> verdad son ~15 líneas en `tokens.py`. El archivo original sigue en
> `paquetes-core/uagrm_sso/jwks.py` si se quiere recuperar.

**`permissions/decorators.py`** (`auto_permisos`) — estampaba metadata en
clases y métodos que ningún escáner leía. `PERMISSIONS_CONFIG['apps_to_scan']`
tampoco se consultaba nunca. La generación de permisos siempre fue una lista
escrita a mano, hoy en `permisos/codigos.py`.

**`bitacora/signals.py`** — conectaba `pre_save` y `pre_delete` a todos los
modelos de `AUDITORIA_APPS_MODELOS`, hacía un SELECT extra por guardado y un
SELECT completo por borrado, y guardaba el snapshot del estado previo en un
almacén thread-local… que el decorador solo borraba, nunca leía. Una query
tirada por cada escritura (500 extra en un bulk de 500 filas).

> ⚠ Consecuencia: la bitácora no registra `antes`/`despues` de una edición ni
> el objeto eliminado — aunque `paquetes-core-instalacion.md` §4.6 lo afirme.
> **Nunca lo hizo**: esto no es una regresión, es dejar de pagar por una
> promesa incumplida. Implementarlo de verdad es leer el snapshot dentro del
> decorador y sumarlo a `detalles`.

---

## 5. Qué cambió de comportamiento

La reorganización preserva el comportamiento salvo en estos puntos, todos
correcciones acotadas:

1. **El error de audiencia ahora llega al cliente.** `"Token no autorizado para
   este sistema."` se lanzaba dentro de un `try` cuyo `except Exception` lo
   capturaba y lo reemplazaba por `"Error de autenticación"`. El rechazo
   ocurría igual; solo el mensaje se perdía.
2. **Los mensajes de permiso denegado ya no enumeran los códigos requeridos.**
   `verificar_permiso` ya había sido corregido para no filtrarlos; las
   variantes "alguno" y "todos" seguían listándolos. Ahora las tres devuelven
   el mismo mensaje genérico y el detalle va al log del servidor.
3. **El `User-Agent` se deriva de `SSO_SYSTEM_SLUG`.** Era la constante literal
   `"certificaciones-backend/1.0"`, así que todo sistema que copiara el paquete
   se anunciaba ante admincentral como certificaciones.
4. **Los settings se leen en cada llamada, no al importar el módulo.**
   `_COOKIE_SECURE` y `_COOKIE_SAMESITE` eran constantes de módulo congeladas
   en el import; ahora `override_settings` funciona en tests.
5. **Todo error de autenticación lleva `extensions.code`.** Antes solo
   `SSO_SESSION_REVOKED` lo llevaba, así que el frontend tenía que hacer
   `mensaje.includes("expirado")` para saber si le convenía renovar el token:
   cambiar una tilde rompía el manejo de sesión de todos los sistemas, en
   silencio. Los mensajes no cambiaron y los nombres `SSO_REVOKED_CODE` /
   `SSO_EXPIRED_CODE` siguen exportados como alias, así que ningún frontend
   existente se rompe: es aditivo.

### Los códigos

Definidos en `core/sso/errores.py`, que también documenta el contrato completo.

| Código | Cuándo | Qué debe hacer el cliente |
|---|---|---|
| `UNAUTHENTICATED` | Falta el token o no es usable | Renovar y reintentar |
| `TOKEN_EXPIRED` | El JWT venció | Renovar y reintentar |
| `TOKEN_INVALID` | Firma o formato inválidos | Renovar y reintentar |
| `TOKEN_WRONG_AUDIENCE` | El token es de otro sistema | Cerrar sesión |
| `SSO_SESSION_REVOKED` | Dispositivo revocado | Cerrar sesión, **no** renovar |
| `SSO_SESSION_EXPIRED` | Fuera de ventana horaria | Cerrar sesión, **no** renovar |
| `FORBIDDEN` | Falta el permiso | Mostrar el error. La sesión está bien |
| `AUTH_ERROR` | Fallo interno al autenticar | Mostrar el error |
| `RESOLVER_MISCONFIGURED` | Resolver protegido sin `info` | Bug del backend |

Dos conjuntos exportados resumen la decisión del cliente:
`CODIGOS_RENOVABLES` (los tres primeros) y `CODIGOS_TERMINALES`. No se solapan.

De paso, `_clasificar_error_autenticacion` en `guards.py` —que decidía si un
intento fallido se auditaba como "sin autenticacion" o "sin autorizacion"—
ahora usa el código en vez de buscar substrings en español, con el matcheo por
texto como respaldo para errores que no salgan de este paquete.

### Revocación de sesión (implementa el manual del 2026-07-09)

Antes, `consumer.py` escribía `sso:session:{user_id}:revoked` en Redis y
**nadie leía esa clave**: los eventos `session_revoked` no cortaban nada. La
revocación funcionaba de rebote, porque admincentral manda `device_revoked`
junto con `session_revoked` y el `dv` sí se validaba — con el mensaje
equivocado ("Dispositivo revocado") incluso para un cierre por inactividad.

Las cinco piezas del manual, ahora completas:

| Pieza | Dónde |
|---|---|
| `publish_session_revoked()` y canal `sso:notify:user:{id}` | `notify.py` |
| Los handlers de `device_revoked` y `session_revoked` publican a ese canal | `consumer.py` |
| El SSE se suscribe al canal del usuario, emite `session_revoked` y cierra el stream; más chequeo al conectar | `views.py` |
| `seed_from_jwt()` **borra** la marca al sembrar una sesión nueva | `state.py` |
| **Paso 0**: si existe la marca → rechaza con `SSO_SESSION_REVOKED` | `validator.py` |

**Las dos últimas son una sola pieza.** El paso 0 sin la limpieza dejaría a un
usuario legítimamente re-logueado rechazado durante 24 h, hasta que expirara la
marca. No toques una sin la otra.

Que el borrado en `seed_from_jwt` sea seguro se apoya en el IdP: solo se llega
ahí después de que admincentral entregó tokens nuevos, y no los entrega si la
sesión sigue revocada.

Tres capas, para que ninguna falla individual deje pasar la revocación:

1. **Push SSE** — expulsión inmediata. Best-effort: se pierde si el navegador
   está cerrado.
2. **Chequeo al conectar** — al reabrir la pestaña, el SSE consulta la marca (y
   el `dv`) y expulsa aunque el PUBLISH se haya perdido.
3. **Corte por request** — el paso 0 del validator rechaza con el motivo real
   (`idle` → "se cerró por inactividad").

---

## 6. Pendientes conocidos

Están anotados en el código, en el módulo donde corresponde intervenir.

| # | Qué | Dónde |
|---|---|---|
| 1 | El SSE no verifica la firma del token y acepta `HS256` | `sso/views.py` |
| 2 | Validación de `aud` fail-open si falta `SSO_SYSTEM_SLUG`; `iss` no se verifica nunca | `sso/tokens.py` |
| 3 | Cola AMQP compartida entre réplicas: cada mensaje llega a un solo worker | `sso/consumer.py` |
| 4 | Mensaje envenenado: `reject(requeue=True)` sin tope de reintentos ni DLQ | `sso/consumer.py` |
| 5 | Sin redacción de campos sensibles en la auditoría | `auditoria/services.py` |
| 6 | FK serializado como instancia en vez de id | `auditoria/serializers.py` |
| 7 | Los decoradores son síncronos: no sirven con resolvers `async def` | `sso/guards.py` |
| 8 | Rotación de clave RSA sin soporte (ver §4) | `sso/tokens.py` |

---

## 7. Documentación desactualizada

Los `.md` de `paquetes-core/` describen el estado anterior. Lo que hay que
corregir en ellos, además de los nombres de import:

- `@RegistrarActividad` **sin argumentos** aparece en los tres ejemplos
  principales de `paquetes-core-instalacion.md`. Esa forma lanza `ValueError`
  en tiempo de import: la descripción siempre fue obligatoria.
- La guía afirma que las cookies son `HttpOnly`. El access token no lo es
  (salvo que se active `SSO_COOKIE_HTTPONLY`).
- La guía afirma que el paquete de permisos "escanea las clases decoradas".
  No escanea nada.
- La guía afirma que la bitácora guarda `antes`/`despues`. No lo hace.
- El callback devuelve `200` con meta-refresh, no `302`.
- `MANUAL-INTEGRACION-SSO-SESSION.md` describe `middleware.py`, `sessions.py`
  y `GET /sso/idle-config`, que no existen en este código.
