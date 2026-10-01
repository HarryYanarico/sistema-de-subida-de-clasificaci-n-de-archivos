# Guía de integración — paquetes core UAGRM

Cómo integrar `core/sso`, `core/permisos` y `core/auditoria` en un sistema
nuevo, backend y frontend, paso a paso.

> **Al terminar:** los usuarios entran por el SSO de admincentral, cada resolver
> valida token y permiso, la actividad se audita, y los cambios de permisos
> llegan al navegador en menos de un segundo sin re-login.

**Tiempo estimado:** 40-60 min backend, 30 min frontend.

---

## Índice

**Parte 0** — [Cómo funciona, en un minuto](#parte-0--cómo-funciona-en-un-minuto)

**Parte A — Backend (Django + Strawberry)**
- [A1. Requisitos](#a1-requisitos)
- [A2. Copiar las carpetas](#a2-copiar-las-carpetas)
- [A3. Dependencias](#a3-dependencias)
- [A4. INSTALLED_APPS](#a4-installed_apps)
- [A5. settings.py](#a5-settingspy--bloque-completo)
- [A6. .env](#a6-env--bloque-completo)
- [A7. Montar las URLs](#a7-montar-las-urls)
- [A8. Migraciones](#a8-migraciones)
- [A9. Definir los permisos de tu sistema](#a9-definir-los-permisos-de-tu-sistema)
- [A10. Proteger resolvers](#a10-proteger-resolvers)
- [A11. El resolver `me`](#a11-el-resolver-me--lo-necesita-el-frontend)
- [A12. Docker: redes de admincentral](#a12-docker-redes-de-admincentral)
- [A13. Registrar el sistema en admincentral](#a13-registrar-el-sistema-en-admincentral)
- [A14. Verificar el backend](#a14-verificar-el-backend)

**Parte B — Frontend (React)**
- [B1. Qué deja el backend en el navegador](#b1-qué-deja-el-backend-en-el-navegador)
- [B2. La ruta `/sso-callback`](#b2-la-ruta-sso-callback)
- [B3. Cliente HTTP con cookies](#b3-cliente-http-con-cookies)
- [B4. Renovación automática de sesión](#b4-renovación-automática-de-sesión)
- [B5. Cargar el usuario y sus permisos](#b5-cargar-el-usuario-y-sus-permisos)
- [B6. Ocultar UI según permisos](#b6-ocultar-ui-según-permisos)
- [B7. Permisos en vivo (SSE)](#b7-permisos-en-vivo-sse)
- [B8. Sesión revocada](#b8-sesión-revocada)
- [B9. Cerrar sesión](#b9-cerrar-sesión)

**Parte C** — [Checklist](#parte-c--checklist)
**Parte D** — [Troubleshooting](#parte-d--troubleshooting)
**Parte E** — [Limitaciones conocidas](#parte-e--limitaciones-conocidas)

---

# Parte 0 — Cómo funciona, en un minuto

```
1. LOGIN
   Usuario → admincentral → (elige tu sistema) → redirige a tu frontend
   con un ticket de un solo uso.

   navegador                tu backend                 admincentral
   ─────────                ──────────                 ────────────
   /sso-callback?ticket=X
        │
        └─ fetch ──────────► GET /api/sso/callback ───► POST /exchange-ticket
                                    │                   ◄── access + refresh
                                    │                       + permissions[]
                                    ├─ guarda permisos en Redis
                                    └─ Set-Cookie: sso_access_token
                                                   sso_refresh_token

2. CADA REQUEST
   POST /graphql con la cookie
        │
        └─► @RequiereAutenticacion  → verifica firma RSA del JWT
            @RequierePermiso        → ¿el permiso está en Redis?
            @RegistrarActividad     → publica el evento a la cola de auditoría

3. CAMBIO DE PERMISOS (sin re-login)
   Admin cambia permisos → RabbitMQ → tu consumer actualiza Redis
                                    → PUBLISH Redis → SSE → navegador
   El navegador llama a refresh-session y recarga. Total: < 1 s.
```

**Lo importante:** los permisos **no viajan en el token**. Viven en el Redis de
tu sistema, indexados por `rol_id`. Por eso se pueden cambiar en caliente.

---

# Parte A — Backend

## A1. Requisitos

| Requisito | Detalle |
|---|---|
| Python | 3.10+ |
| Django | 4.2+ |
| GraphQL | Strawberry (`strawberry-graphql-django`) |
| Servidor | **ASGI** — uvicorn o gunicorn con worker uvicorn. El stream SSE no funciona bajo WSGI puro |
| Redis | Alcanzable desde tu backend. Guarda permisos y estado de sesión |
| RabbitMQ | El de admincentral. Sin él, los permisos solo se actualizan al hacer login |
| Acceso | Poder registrar tu sistema en el panel de admincentral |

---

## A2. Copiar las carpetas

Copiá el directorio `core/` completo a la raíz de tu proyecto, al lado de
`manage.py`:

```
mi_proyecto/
├── manage.py
├── config/
│   ├── settings.py
│   └── urls.py
├── apps/
│   └── mi_app/
└── core/                ← copiar acá
    ├── sso/
    ├── permisos/
    └── auditoria/
```

> ⚠ **`core/` NO debe tener `__init__.py`.** Es un *namespace package*. Si le
> creás uno, Python puede resolver mal los submódulos. Las subcarpetas
> (`sso/`, `permisos/`, `auditoria/`) sí lo tienen — eso está bien.

Verificá que quedó bien:

```bash
python -c "import core.sso, core.permisos, core.auditoria; print('ok')"
```

---

## A3. Dependencias

```bash
pip install "Django>=4.2" strawberry-graphql-django PyJWT cryptography \
            requests django-redis redis kombu pika
```

En tu `requirements.txt`:

```
Django>=4.2
strawberry-graphql-django
PyJWT>=2.4
cryptography          # obligatorio: PyJWT lo necesita para RS256
requests
django-redis
redis
kombu                 # consumer AMQP
pika                  # bitácora
uvicorn[standard]     # servidor ASGI
```

Para qué sirve cada una:

| Paquete | Lo usa | Si falta |
|---|---|---|
| `PyJWT` + `cryptography` | `core.sso.tokens` | No se puede verificar ningún token |
| `requests` | `core.sso.client` | No se puede canjear el ticket |
| `django-redis` + `redis` | `core.sso.state`, SSE | No hay permisos ni notificaciones |
| `kombu` | `core.sso.consumer` | Los permisos no se actualizan en caliente |
| `pika` | `core.auditoria` | No se registra actividad |

---

## A4. INSTALLED_APPS

```python
INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    # ... el resto de las tuyas ...

    "core.sso",         # arranca el consumer AMQP al iniciar
    "core.permisos",    # catálogo de permisos (tabla `permisos`)
    "core.auditoria",   # bitácora

    "apps.mi_app",
]
```

El orden no importa. `core.sso` levanta el consumer en `ready()`, pero solo si
el proceso es un servidor web — no en `migrate`, `shell` ni Celery.

---

## A5. `settings.py` — bloque completo

Copiá este bloque tal cual y ajustá los valores marcados:

```python
import os

# ═══════════════════════════════════════════════════════════════
#  SSO — comunicación con admincentral
# ═══════════════════════════════════════════════════════════════
URL_API_SSO    = os.getenv("URL_API_SSO", "http://admincentral-backend:8003")
SSO_API_KEY    = os.getenv("SSO_API_KEY", "")
SSO_SYSTEM_KEY = os.getenv("SSO_SYSTEM_KEY", "")

# Slug de TU sistema. Debe coincidir EXACTAMENTE con el registrado en
# admincentral: nombra la cola AMQP y viaja como claim `aud` en el JWT.
SSO_SYSTEM_SLUG = os.getenv("SSO_SYSTEM_SLUG", "")

# Clave pública RSA de admincentral (los saltos de línea van como \n)
JWT_LLAVE_PUBLICA = os.getenv("JWT_LLAVE_PUBLICA", "")
if not JWT_LLAVE_PUBLICA:
    import warnings
    warnings.warn(
        "JWT_LLAVE_PUBLICA no configurada — la autenticación no funcionará.",
        RuntimeWarning,
    )

# ═══════════════════════════════════════════════════════════════
#  SSO — cookies de sesión
# ═══════════════════════════════════════════════════════════════
# ⚠ ESTA LÍNEA ES OBLIGATORIA. El paquete NO lee USE_HTTPS por su cuenta.
#   Sin ella, las cookies salen siempre con Secure=True y sobre HTTP el
#   navegador las descarta en silencio → "Sesión Inválida" al entrar.
SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", "False") == "True"

SSO_COOKIE_SAMESITE = "Lax"

# False (default): el frontend puede leer el JWT desde document.cookie.
# True: lo protege de XSS. Poné True si tu frontend NO necesita leer el token
#       — con el resolver `me` de A11 no lo necesita.
SSO_COOKIE_HTTPONLY = False

# ═══════════════════════════════════════════════════════════════
#  SSO — eventos en tiempo real
# ═══════════════════════════════════════════════════════════════
SSO_AMQP_URL = os.getenv("SSO_AMQP_URL", "")   # vacío → consumer inactivo

# ═══════════════════════════════════════════════════════════════
#  Redis — permisos y estado de sesión (OBLIGATORIO)
# ═══════════════════════════════════════════════════════════════
REDIS_CACHE_URL = os.getenv("REDIS_CACHE_URL", "redis://redis:6379/1")

CACHES = {
    "default": {
        "BACKEND":  "django_redis.cache.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
        "OPTIONS":  {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

# ⚠ Tiene que ser Redis, NO LocMemCache. Con cache local cada worker de
#   gunicorn tendría permisos distintos y las revocaciones no se propagarían.

# ═══════════════════════════════════════════════════════════════
#  Bitácora de actividad
# ═══════════════════════════════════════════════════════════════
AUDITORIA_RABBIT_URL     = os.getenv("AUDITORIA_RABBIT_URL", "")
AUDITORIA_RABBIT_QUEUE   = os.getenv("AUDITORIA_RABBIT_QUEUE", "auditoria_queue")
AUDITORIA_SISTEMA_ORIGEN = "mi-sistema"        # ← CAMBIAR: cómo te ves en la auditoría

# ═══════════════════════════════════════════════════════════════
#  Catálogo de permisos
# ═══════════════════════════════════════════════════════════════
PERMISSIONS_CONFIG = {
    # ⚠ Dejalo en False. Con True, cada arranque BORRA de la tabla los
    #   permisos que no estén en core/permisos/codigos.py. Un deploy con el
    #   código desactualizado elimina permisos en producción.
    #   Sincronizá a mano: python manage.py generar_permisos
    "auto_generate": False,
}
```

### El slug: guiones vs. guiones bajos

Es la confusión más frecuente. Son dos cosas distintas:

| Dónde | Formato | Ejemplo |
|---|---|---|
| `SSO_SYSTEM_SLUG`, cola AMQP, claim `aud` | **guiones** | `sistema-titulos` |
| Prefijo de los códigos de permiso | **guiones bajos** | `sistema_titulos_imprimir` |

No los mezcles: si `SSO_SYSTEM_SLUG` no coincide letra por letra con el slug
registrado en admincentral, el token se rechaza.

---

## A6. `.env` — bloque completo

```bash
# ── SSO ────────────────────────────────────────────────────────────────
URL_API_SSO=http://admincentral-backend:8003
SSO_API_KEY=<te lo da DTIC — es VALID_API_KEYS de admincentral>
SSO_SYSTEM_KEY=<se muestra UNA sola vez al activar SSO en admincentral>
SSO_SYSTEM_SLUG=mi-sistema

JWT_LLAVE_PUBLICA="-----BEGIN PUBLIC KEY-----\nMIIBIjAN...IDAQAB\n-----END PUBLIC KEY-----"

# ── Eventos en tiempo real ─────────────────────────────────────────────
# El usuario es "admincentral", NO "admin"
SSO_AMQP_URL=amqp://admincentral:<PASSWORD>@admincentral-rabbitmq:5672

# ── Redis ──────────────────────────────────────────────────────────────
REDIS_CACHE_URL=redis://redis:6379/1

# ── Bitácora ───────────────────────────────────────────────────────────
AUDITORIA_RABBIT_URL=amqp://admin:<PASSWORD>@rabbitmq:5672
AUDITORIA_RABBIT_QUEUE=auditoria_queue

# ── HTTPS ──────────────────────────────────────────────────────────────
# False mientras el sitio corra por HTTP sin certificado.
# True SOLO con SSL real. Con True sobre HTTP el login falla en silencio.
USE_HTTPS=False
```

> Recordá que `USE_HTTPS` solo funciona si pusiste la línea
> `SSO_COOKIE_SECURE = ...` de A5. Sin ella, esta variable no hace nada.

---

## A7. Montar las URLs

```python
# config/urls.py
from django.urls import path
from core.sso.urls import urlpatterns as sso_urlpatterns

urlpatterns = [
    path("graphql", ...),
    # ... tus rutas ...
] + sso_urlpatterns
```

> ⚠ **Sumalas con `+`, no con `include()`.** Las rutas ya traen el prefijo
> `api/sso/` adentro. Si hacés `path("sso/", include("core.sso.urls"))` te
> queda `/sso/api/sso/callback` y el callback deja de coincidir con el
> registrado en admincentral.

Esto expone tres endpoints:

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/sso/callback?ticket=<uuid>` | Canjea el ticket, siembra Redis, setea cookies |
| `POST` | `/api/sso/refresh-session` | Renueva el access token con la cookie de refresh |
| `GET` | `/api/sso/events` | Stream SSE de cambios de permisos |

---

## A8. Migraciones

```bash
python manage.py migrate permisos
```

Crea la tabla `permisos`.

**Si tu proyecto ya tenía la tabla** (venís de `core/permissions`):

```bash
python manage.py migrate permisos --fake-initial
```

Y si además tenías una migración generada localmente bajo el label viejo:

```bash
python manage.py shell -c "
from django.db.migrations.recorder import MigrationRecorder
MigrationRecorder.Migration.objects.filter(app='permissions').delete()"
```

---

## A9. Definir los permisos de tu sistema

El catálogo que viene es el de **títulos**. Reemplazalo por el tuyo en
`core/permisos/codigos.py`.

**Regla de oro:** pocos permisos y agrupados por capacidad, no uno por método.
12 permisos que un administrador entiende sirven más que 80 que no va a
configurar nunca.

```python
# core/permisos/codigos.py

class Permisos:
    """Códigos de permiso del sistema."""

    # Prefijo = slug con guiones BAJOS
    CONSULTAR      = "mi_sistema_consultar"
    REGISTRAR      = "mi_sistema_registrar"
    APROBAR        = "mi_sistema_aprobar"
    CONFIGURAR     = "mi_sistema_configurar"
    ADMIN_USUARIOS = "mi_sistema_admin_usuarios"

    TODOS: frozenset = frozenset()   # se completa solo al final del archivo


_RECURSO = "mi_sistema"


CATALOGO: tuple[DefinicionPermiso, ...] = (
    DefinicionPermiso(
        Permisos.CONSULTAR,
        "Consultar",                                   # nombre visible en el panel
        "Permite ver solicitudes, historial y reportes.",   # descripción para el admin
        _RECURSO, "consultar",
    ),
    DefinicionPermiso(
        Permisos.REGISTRAR,
        "Registrar solicitudes",
        "Permite crear y editar solicitudes propias.",
        _RECURSO, "registrar",
    ),
    DefinicionPermiso(
        Permisos.APROBAR,
        "Aprobar y rechazar",
        "Permite aprobar, rechazar y devolver solicitudes.",
        _RECURSO, "aprobar",
    ),
    # ... uno por cada constante ...
)
```

`Permisos.TODOS` se calcula solo desde `CATALOGO` — no lo escribas a mano.

Después sincronizá con la base:

```bash
python manage.py generar_permisos
```

```
📋 Sincronizando permisos del sistema...
  ✓ Creado:      mi_sistema_consultar
  ✓ Creado:      mi_sistema_registrar
  ...
✅ Proceso completado: 5 creados, 0 actualizados, 0 eliminados
```

> ⚠ Por defecto **borra** de la tabla los permisos que ya no estén en el
> catálogo. Para una pasada segura que solo agrega y actualiza:
> `python manage.py generar_permisos --conservar-obsoletos`

**Para agregar un permiso más adelante:** constante en `Permisos` → entrada en
`CATALOGO` → `generar_permisos`. Los tres pasos, siempre.

---

## A10. Proteger resolvers

### El orden de los decoradores

```python
import strawberry
from core.sso import RequiereAutenticacion, RequierePermiso
from core.auditoria import RegistrarActividad
from core.permisos import Permisos


@strawberry.type
class Mutaciones:

    @strawberry.mutation
    @RequiereAutenticacion                       # 1º — ¿el token es válido?
    @RequierePermiso(Permisos.REGISTRAR)         # 2º — ¿tiene el permiso?
    @RegistrarActividad("registro de solicitud") # 3º — SIEMPRE el más interno
    def crear_solicitud(self, info: strawberry.Info, titulo: str) -> bool:
        usuario = info.context.usuario
        Solicitud.objects.create(titulo=titulo, creado_por=usuario["id_usuario"])
        return True
```

**El orden no es estético, es funcional.** `@RegistrarActividad` estampa la
descripción de la acción en el wrapper, y `functools.wraps` la propaga hacia
arriba. Si no es el más interno, los guards no la encuentran y los intentos
fallidos no se registran.

```
@strawberry.mutation
@RequiereAutenticacion        ← lee __bitacora_accion__  ✓
@RequierePermiso(...)         ← lee __bitacora_accion__  ✓
@RegistrarActividad("...")    ← lo estampa
def crear_solicitud(...)
```

### Errores comunes

```python
# ❌ Falla en tiempo de import: ValueError
@RegistrarActividad
def crear(self, info): ...

# ✅ La descripción es obligatoria
@RegistrarActividad("creacion de solicitud")
def crear(self, info): ...


# ❌ El resolver NO recibe `info` → GraphQLError en cada llamada
@RequiereAutenticacion
def listar(self) -> list[str]: ...

# ✅ `info: strawberry.Info` es obligatorio en todo resolver protegido
@RequiereAutenticacion
def listar(self, info: strawberry.Info) -> list[str]: ...


# ❌ String literal — si el código cambia, esto queda roto en silencio
@RequierePermiso("mi_sistema_registrar")

# ✅ Siempre la constante
@RequierePermiso(Permisos.REGISTRAR)
```

### Todos los decoradores disponibles

| Decorador | Cuándo |
|---|---|
| `@RequiereAutenticacion` | Solo hace falta estar logueado |
| `@RequierePermiso(Permisos.X)` | Un permiso exacto |
| `@RequiereAlgunPermiso(Permisos.A, Permisos.B)` | Al menos uno de varios |
| `@RequiereTodosPermisos(Permisos.A, Permisos.B)` | Todos a la vez |
| `@RegistrarActividad("descripción")` | Auditar la operación |

### Datos del usuario dentro del resolver

Después de `@RequiereAutenticacion` tenés dos formas equivalentes:

```python
def mi_resolver(self, info: strawberry.Info):
    # Opción 1 — dict plano (la más usada)
    usuario = info.context.usuario
    usuario["id_usuario"]           # UUID del usuario
    usuario["nombre_usuario"]       # username
    usuario["nombre"]               # nombre completo
    usuario["correo"]
    usuario["codigo_usuario"]       # código de empleado
    usuario["unidad_codigo"]        # código de unidad
    usuario["cargo"]                # slug del rol de esta sesión
    usuario["rol_id"]               # UUID del rol
    usuario["permisos"]             # set[str] de códigos
    usuario["device_hash"]
    usuario["profile_picture_url"]

    # Opción 2 — objeto, compatible con request.user de Django
    u = info.context.request.user
    u.user_id, u.username, u.nombre_completo, u.email
    u.codigo_funcionario, u.codigo_unidad, u.cargo, u.rol_id
    u.has_perm(Permisos.APROBAR)    # → bool
```

> **`cargo` / `rol_id` son el rol de ESTA sesión**, no la lista completa de lo
> que la persona puede hacer. Un usuario con varios roles elige con cuál entrar
> y puede volver con otro. Usalos para mostrar el cargo o elegir el panel
> inicial — **nunca para autorizar**. Para autorizar, siempre permisos.

### Chequeo de permisos dentro del código

Cuando la decisión no es "pasa o no pasa" sino "qué le muestro":

```python
def listar_solicitudes(self, info: strawberry.Info) -> list[SolicitudType]:
    usuario = info.context.request.user
    qs = Solicitud.objects.all()
    if not usuario.has_perm(Permisos.APROBAR):
        qs = qs.filter(creado_por=usuario.user_id)   # solo las propias
    return qs
```

---

## A11. El resolver `me` — lo necesita el frontend

**Esto no es opcional.** Los permisos no viajan en el token, así que el
frontend no tiene forma de saber qué mostrar si el backend no se lo dice.

```python
# apps/mi_app/types.py
import strawberry
from typing import Optional


@strawberry.type
class UsuarioActualType:
    id: str
    username: str
    nombre_completo: str
    correo: Optional[str]
    codigo_unidad: Optional[str]
    cargo: Optional[str]
    rol_id: Optional[str]
    foto_url: Optional[str]
    permisos: list[str]


# apps/mi_app/queries.py
import strawberry
from core.sso import RequiereAutenticacion


@strawberry.type
class Consultas:

    @strawberry.field
    @RequiereAutenticacion
    def me(self, info: strawberry.Info) -> UsuarioActualType:
        u = info.context.usuario
        return UsuarioActualType(
            id=str(u["id_usuario"]),
            username=u["nombre_usuario"] or "",
            nombre_completo=u["nombre"] or "",
            correo=u["correo"],
            codigo_unidad=u["unidad_codigo"],
            cargo=u["cargo"],
            rol_id=u["rol_id"],
            foto_url=u["profile_picture_url"],
            permisos=sorted(u["permisos"]),
        )
```

> ⚠ **Todos los campos de tipo `str` no-opcional deben tener fallback a `""`.**
> Si `id` queda en `None`, GraphQL rechaza la respuesta entera con
> `Cannot return null for non-nullable field` y el frontend ve "sesión
> inválida" aunque el login haya funcionado.

Con este resolver, el frontend **no necesita leer el JWT**, y podés poner
`SSO_COOKIE_HTTPONLY = True` para protegerlo de XSS.

---

## A12. Docker: redes de admincentral

```yaml
# docker-compose.yml
services:
  backend:
    networks:
      - default
      - admincentral-sync-net          # llamar al IdP (exchange, refresh)
      - admincentral-rabbitmq-to-net   # recibir eventos AMQP

networks:
  admincentral-sync-net:
    name: infraestructura-admincentral_admincentral-sync-net
    external: true

  admincentral-rabbitmq-to-net:
    name: infraestructura-admincentral_admincentral-rabbitmq-to-net
    external: true
```

> Los contenedores de Celery **no** deben unirse a
> `admincentral-rabbitmq-to-net`. El consumer corre en el proceso web.

Levantá el backend con ASGI:

```yaml
    command: uvicorn config.asgi:application --host 0.0.0.0 --port 8000
```

---

## A13. Registrar el sistema en admincentral

1. admincentral → **Sistemas** → **Nuevo sistema**
2. Completar:
   - **Slug:** el mismo de `SSO_SYSTEM_SLUG` (ej. `mi-sistema`)
   - **URL Callback OIDC:** `http://<tu-host>:<puerto>/sso-callback`
   - Activar **Consumer AMQP desplegado**
3. **Activar y generar claves SSO**
4. Copiar la **System Key** → `SSO_SYSTEM_KEY` del `.env`

> ⚠ **La URL Callback apunta al FRONTEND (`/sso-callback`), no al backend
> (`/api/sso/callback`).** AdminCentral manda el navegador ahí. Si apuntás al
> endpoint Django, el usuario ve una página en blanco o JSON crudo en vez de
> tu aplicación.

| ❌ Incorrecto | ✅ Correcto |
|---|---|
| `http://host:8000/api/sso/callback` | `http://host:5173/sso-callback` |

La System Key **se muestra una sola vez**. Si la perdés, hay que regenerarla.

---

## A14. Verificar el backend

```bash
# 1. El consumer arrancó
docker logs mi-backend 2>&1 | grep SSOEventConsumer
# Esperado: "SSOEventConsumer: conectado — exchange=sso.events queue=sso.events.mi-sistema"

# 2. La cola tiene consumidor
docker exec admincentral-rabbitmq rabbitmqctl list_queues name messages consumers
# Esperado: sso.events.mi-sistema  0  1

# 3. Los permisos están en la tabla
python manage.py shell -c "
from core.permisos.models import Permiso; print(Permiso.objects.count())"

# 4. Después de un login, los permisos llegaron a Redis
python manage.py shell -c "
from core.sso import get_local_perms; print(get_local_perms('<rol_id>'))"
# Esperado: ['mi_sistema_consultar', ...]

# 5. El endpoint SSE responde
curl -N --cookie "sso_access_token=<token>" http://localhost:8000/api/sso/events
# Esperado: ": keep-alive" y luego ": ping" cada 25 s

# 6. La revocación de sesión funciona de punta a punta
#    a. Dejá corriendo el curl del paso 5 en una terminal.
#    b. Desde admincentral, revocá la sesión de ese usuario.
#    c. En el curl debe aparecer, en menos de un segundo:
#         event: session_revoked
#         data: {"userId": "...", "reason": "..."}
#       y el stream debe cerrarse solo.
#    d. Volvé a entrar por el SSO: debe funcionar a la primera, sin bloqueo.
```

---

# Parte B — Frontend

## B1. Qué deja el backend en el navegador

Después del callback exitoso quedan dos cookies:

| Cookie | HttpOnly | Para qué |
|---|---|---|
| `sso_access_token` | Según `SSO_COOKIE_HTTPONLY` (default: **no**) | Se manda en cada request |
| `sso_refresh_token` | **Siempre sí** | Solo la usa `/api/sso/refresh-session` |

**No guardes tokens en `localStorage`.** El backend ya los maneja por cookie;
duplicarlos solo agrega superficie de ataque. Tu frontend nunca necesita tocar
el JWT: usa el resolver `me` de A11.

### CORS

Si el frontend y el backend están en **orígenes distintos** (ej. `:5173` y
`:8000`), configurá CORS con credenciales en el backend:

```python
CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
CORS_ALLOW_CREDENTIALS = True     # obligatorio para que viajen las cookies
```

Lo más simple es **evitar el problema**: serví el frontend detrás del mismo
dominio con un proxy (`/api` y `/graphql` al backend). Así `SameSite=Lax`
funciona sin más.

---

## B2. La ruta `/sso-callback`

Es la página a la que admincentral manda al usuario después del login. Su único
trabajo: llamar al backend para canjear el ticket y luego entrar a la app.

```tsx
// src/pages/SSOCallback.tsx
import { useEffect, useRef, useState } from "react";

export default function SSOCallback() {
  const [error, setError] = useState<string | null>(null);
  const yaCorrio = useRef(false);   // React 18 StrictMode monta dos veces

  useEffect(() => {
    if (yaCorrio.current) return;
    yaCorrio.current = true;

    const ticket = new URLSearchParams(window.location.search).get("ticket");
    if (!ticket) {
      setError("No se recibió el ticket de autenticación.");
      return;
    }

    fetch(`/api/sso/callback?ticket=${encodeURIComponent(ticket)}`, {
      credentials: "include",       // sin esto las cookies NO se guardan
    })
      .then((res) => {
        if (!res.ok) throw new Error("El ticket es inválido o ya expiró.");
        // Las cookies ya quedaron por los headers Set-Cookie.
        // Navegación dura para que la app arranque con la sesión puesta.
        window.location.replace("/");
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <h2>No pudimos iniciar tu sesión</h2>
        <p>{error}</p>
        <a href="/">Volver a intentar</a>
      </div>
    );
  }

  return <div style={{ padding: 32 }}>Iniciando sesión…</div>;
}
```

Registrala en tu router:

```tsx
<Route path="/sso-callback" element={<SSOCallback />} />
```

> ⚠ **Tres detalles que rompen esta pantalla:**
>
> 1. **`credentials: "include"` es obligatorio.** Sin eso el navegador ignora
>    los `Set-Cookie` y el usuario vuelve al login en bucle.
> 2. **El ticket es de un solo uso.** El `useRef` evita que StrictMode lo
>    canjee dos veces en desarrollo (el segundo intento da 400).
> 3. **El backend responde `200` con HTML, no `302`.** Devuelve una página con
>    `<meta http-equiv="refresh">` que solo actúa si el navegador *navega* a la
>    URL. Como acá usamos `fetch`, ese HTML se descarta: **la navegación la
>    tenés que hacer vos** con `window.location.replace("/")`.

---

## B3. Cliente HTTP con cookies

Todas las llamadas al backend necesitan `credentials: "include"`.

```ts
// src/lib/api.ts
export async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch("/graphql", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new GraphQLError(json.errors[0]);
  }
  return json.data as T;
}

export class GraphQLError extends Error {
  codigo?: string;
  constructor(err: { message: string; extensions?: { code?: string } }) {
    super(err.message);
    this.codigo = err.extensions?.code;
  }
}
```

**Con Apollo Client:**

```ts
const httpLink = new HttpLink({
  uri: "/graphql",
  credentials: "include",   // ← equivalente
});
```

---

## B4. Renovación automática de sesión

El access token dura poco (15-30 min); el refresh dura más. Cuando el access
expira, el backend responde con un error y hay que renovar **una vez** y
reintentar.

### Los códigos de error

Todo error de autenticación del backend viaja con `extensions.code`. **Nunca
mires el texto del mensaje**: los mensajes cambian, los códigos son contrato.

| `extensions.code` | Qué pasó | Qué hace el frontend |
|---|---|---|
| `UNAUTHENTICATED` | Falta el token o no es usable | Renovar y reintentar |
| `TOKEN_EXPIRED` | El JWT venció | Renovar y reintentar |
| `TOKEN_INVALID` | Firma o formato inválidos | Renovar y reintentar |
| `TOKEN_WRONG_AUDIENCE` | El token es de otro sistema | Cerrar sesión |
| `SSO_SESSION_REVOKED` | Dispositivo revocado por un admin | Cerrar sesión, **no** renovar |
| `SSO_SESSION_EXPIRED` | Fuera de la ventana horaria | Cerrar sesión, **no** renovar |
| `FORBIDDEN` | Falta el permiso | Mostrar el error. La sesión está bien |
| `AUTH_ERROR` | Fallo interno al autenticar | Mostrar el error |
| `RESOLVER_MISCONFIGURED` | Bug del backend | Reportarlo al equipo |

La distinción que más importa: **`FORBIDDEN` no es un problema de sesión.**
Renovar el token ante un `FORBIDDEN` no cambia nada y confunde al usuario con
un login que no hacía falta.

```ts
// src/lib/session.ts

/** Se arreglan renovando el token. Espejo de CODIGOS_RENOVABLES del backend. */
const RENOVABLES = new Set(["UNAUTHENTICATED", "TOKEN_EXPIRED", "TOKEN_INVALID"]);

/** Hay que cerrar sesión: renovar no sirve. Espejo de CODIGOS_TERMINALES. */
const TERMINALES = new Set([
  "SSO_SESSION_REVOKED",
  "SSO_SESSION_EXPIRED",
  "TOKEN_WRONG_AUDIENCE",
]);

const MOTIVOS: Record<string, string> = {
  SSO_SESSION_REVOKED:  "Tu sesión fue revocada por un administrador.",
  SSO_SESSION_EXPIRED:  "Tu sesión expiró por horario.",
  TOKEN_WRONG_AUDIENCE: "Tu sesión no corresponde a este sistema.",
};

/** Renueva el access token. true = renovado, false = hay que volver al login. */
export async function renovarSesion(): Promise<boolean> {
  try {
    const res = await fetch("/api/sso/refresh-session", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

Y el wrapper que reintenta:

```ts
export async function graphqlConReintento<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  try {
    return await graphql<T>(query, variables);
  } catch (err) {
    if (!(err instanceof GraphQLError) || !err.codigo) throw err;

    if (TERMINALES.has(err.codigo)) {
      cerrarSesion(MOTIVOS[err.codigo]);
      throw err;
    }

    if (RENOVABLES.has(err.codigo)) {
      if (await renovarSesion()) {
        return await graphql<T>(query, variables);   // un solo reintento
      }
      cerrarSesion("Tu sesión expiró.");
    }

    // FORBIDDEN, AUTH_ERROR y cualquier otro: que lo maneje quien llamó.
    throw err;
  }
}
```

**Con Apollo**, lo mismo como `onError` link:

```ts
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client";

const errorLink = onError(({ graphQLErrors, operation, forward }) => {
  const codigo = graphQLErrors?.[0]?.extensions?.code as string | undefined;
  if (!codigo) return;

  if (TERMINALES.has(codigo)) {
    cerrarSesion(MOTIVOS[codigo]);
    return;
  }

  if (RENOVABLES.has(codigo)) {
    return fromPromise(
      renovarSesion().then((ok) => {
        if (!ok) cerrarSesion("Tu sesión expiró.");
        return ok;
      }),
    ).flatMap((ok) => (ok ? forward(operation) : fromPromise(Promise.resolve())));
  }
});
```

> **Mantené los dos `Set` en sincronía con el backend.** Son el espejo de
> `CODIGOS_RENOVABLES` y `CODIGOS_TERMINALES` de `core/sso/errores.py`, donde
> está el contrato completo comentado.

---

## B5. Cargar el usuario y sus permisos

Un contexto que consulta `me` una vez y lo comparte con toda la app.

```tsx
// src/auth/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { graphql } from "../lib/api";

const QUERY_ME = `
  query { me {
    id username nombreCompleto correo codigoUnidad cargo rolId fotoUrl permisos
  } }
`;

export type Usuario = {
  id: string;
  username: string;
  nombreCompleto: string;
  correo?: string;
  codigoUnidad?: string;
  cargo?: string;
  rolId?: string;
  fotoUrl?: string;
  permisos: string[];
};

type Estado = {
  usuario: Usuario | null;
  cargando: boolean;
  puede: (permiso: string) => boolean;
  puedeAlguno: (...permisos: string[]) => boolean;
  recargar: () => Promise<void>;
};

const Ctx = createContext<Estado>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      const data = await graphql<{ me: Usuario }>(QUERY_ME);
      setUsuario(data.me);
    } catch {
      setUsuario(null);       // sin sesión válida
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Set para que la comprobación sea O(1) aunque haya muchos permisos
  const set = new Set(usuario?.permisos ?? []);

  return (
    <Ctx.Provider value={{
      usuario,
      cargando,
      puede: (p) => set.has(p),
      puedeAlguno: (...ps) => ps.some((p) => set.has(p)),
      recargar: cargar,
    }}>
      {children}
    </Ctx.Provider>
  );
}
```

Y la guarda de rutas:

```tsx
// src/auth/RutaProtegida.tsx
export function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth();

  if (cargando) return <Cargando />;
  if (!usuario) {
    window.location.href = import.meta.env.VITE_URL_LOGIN_SSO;
    return null;
  }
  return <>{children}</>;
}
```

Espejo de los códigos de permiso, para no escribir strings sueltos:

```ts
// src/auth/permisos.ts — debe coincidir con core/permisos/codigos.py
export const Permisos = {
  CONSULTAR:      "mi_sistema_consultar",
  REGISTRAR:      "mi_sistema_registrar",
  APROBAR:        "mi_sistema_aprobar",
  CONFIGURAR:     "mi_sistema_configurar",
  ADMIN_USUARIOS: "mi_sistema_admin_usuarios",
} as const;
```

---

## B6. Ocultar UI según permisos

```tsx
// src/auth/Si.tsx
export function Si({ puede: permiso, children }: {
  puede: string;
  children: React.ReactNode;
}) {
  const { puede } = useAuth();
  return puede(permiso) ? <>{children}</> : null;
}
```

```tsx
<Si puede={Permisos.APROBAR}>
  <button onClick={aprobar}>Aprobar solicitud</button>
</Si>

{/* O directo */}
const { puede } = useAuth();
{puede(Permisos.CONFIGURAR) && <ItemMenu to="/configuracion" />}
```

> ⚠ **Esto es cosmética, no seguridad.** Ocultar un botón no impide que
> alguien llame a la mutación. La autorización real la hace
> `@RequierePermiso` en el backend, siempre. El frontend solo evita mostrar
> acciones que van a fallar.

---

## B7. Permisos en vivo (SSE)

Cuando un administrador cambia los permisos de un rol, el backend lo empuja al
navegador y la sesión se actualiza sin re-login.

El stream emite **dos** eventos. Registrá los dos en el mismo hook:

| Evento | Cuándo | Qué hacer |
|---|---|---|
| `permission_change` | Cambiaron los permisos del rol | Renovar y releer permisos. **Sin** logout |
| `session_revoked` | La sesión fue cerrada | Cerrar sesión y volver al login |

```tsx
// src/auth/useSSEPermisos.ts
import { useEffect } from "react";
import { renovarSesion, cerrarSesion } from "../lib/session";
import { useAuth } from "./AuthContext";

const MOTIVOS_SSE: Record<string, string> = {
  idle:           "Tu sesión se cerró por inactividad.",
  device_revoked: "Tu dispositivo fue revocado por un administrador.",
};

export function useSSEPermisos() {
  const { usuario, recargar } = useAuth();

  useEffect(() => {
    if (!usuario) return;                 // sin sesión no hay nada que escuchar

    const es = new EventSource("/api/sso/events", { withCredentials: true });

    es.addEventListener("permission_change", async () => {
      // Renovar el token para que traiga el pv nuevo, y releer los permisos.
      await renovarSesion();
      await recargar();                   // sin recargar la página entera
    });

    es.addEventListener("session_revoked", (e) => {
      es.close();                         // el backend ya cerró el stream
      let motivo = "";
      try {
        motivo = JSON.parse((e as MessageEvent).data).reason ?? "";
      } catch { /* payload inesperado: cerramos igual */ }
      cerrarSesion(MOTIVOS_SSE[motivo] ?? "Tu sesión fue cerrada.");
    });

    es.onerror = () => {
      // EventSource reconecta solo. No hace falta hacer nada acá.
    };

    return () => es.close();              // ← imprescindible al desmontar
  }, [usuario?.id]);
}
```

Montalo una sola vez, en la raíz de la parte autenticada:

```tsx
function AppAutenticada() {
  useSSEPermisos();
  return <Rutas />;
}
```

**Cómo funciona por dentro:**

```
Admin cambia permisos                    Admin revoca la sesión
  → RabbitMQ (exchange sso.events)         → RabbitMQ
  → tu consumer actualiza Redis            → tu consumer marca la revocación
  → PUBLISH  sso:notify:rol:{rol_id}       → PUBLISH  sso:notify:user:{user_id}
  → SSOEventsView lo escribe al stream     → SSOEventsView lo escribe y CIERRA
  → EventSource: "permission_change"       → EventSource: "session_revoked"
Total: < 1 segundo
```

> **Después de `session_revoked` el backend cierra el stream.** No intentes
> reconectar: el `es.close()` del handler evita que `EventSource` reintente
> solo mientras hacés el logout.

Notas de operación:

- El stream manda `: ping` cada 25 s para que los proxies no lo corten.
- Al conectar, si los permisos cambiaron mientras el navegador estaba cerrado,
  el evento se emite de entrada.
- **Gunicorn corta streams largos.** Usá `--timeout 0` en los workers que
  atienden SSE, o mejor, uvicorn.

---

## B8. Sesión revocada

Un administrador puede cerrar la sesión de un usuario, y el IdP también la
cierra solo por inactividad. El corte llega por **tres vías**, y no hace falta
que las tres funcionen: alcanza con una.

| Vía | Cuándo actúa | Qué la dispara |
|---|---|---|
| 1. Push SSE | Al instante, con la pestaña abierta | Evento `session_revoked` (B7) |
| 2. Al reconectar | Al reabrir la pestaña | El SSE consulta el estado al conectar |
| 3. Por request | En la próxima acción del usuario | `SSO_SESSION_REVOKED` (B4) |

La vía 1 es best-effort: si el navegador estaba cerrado, el aviso se pierde. La
vía 2 lo cubre — el backend guarda la revocación en Redis, así que al reabrir
la pestaña el stream expulsa igual, sin esperar a que el usuario haga clic. La
vía 3 es la red final si el SSE está bloqueado por un proxy.

**No tenés que programar nada extra:** las vías 1 y 3 ya están en el hook de B7
y en el wrapper de B4. Solo necesitás el `cerrarSesion` que las dos invocan:

```ts
// src/lib/session.ts
export function cerrarSesion(motivo?: string) {
  if (motivo) sessionStorage.setItem("motivoCierre", motivo);
  localStorage.clear();
  sessionStorage.removeItem("cache");
  window.location.href = import.meta.env.VITE_URL_LOGIN_SSO;
}
```

Y mostrás el motivo en la pantalla de login:

```tsx
const motivo = sessionStorage.getItem("motivoCierre");
useEffect(() => { sessionStorage.removeItem("motivoCierre"); }, []);
{motivo && <Alerta tipo="advertencia">{motivo}</Alerta>}
```

El backend distingue el motivo, así que el mensaje es específico:

| `reason` | Mensaje del backend |
|---|---|
| `idle` | "Tu sesión se cerró por inactividad. Por favor, vuelve a ingresar." |
| `device_revoked` | "Dispositivo revocado. Contacta al administrador del sistema." |
| otro / ninguno | "Tu sesión fue cerrada. Por favor, vuelve a ingresar." |

> **El re-login funciona a la primera.** La marca de revocación se borra sola
> cuando el usuario vuelve a entrar por el SSO, así que no queda bloqueado.
> Si ves lo contrario, tu backend tiene `state.py` desactualizado.

---

## B9. Cerrar sesión

No hay endpoint de logout en el paquete. El cierre es del lado del cliente,
más el logout central de admincentral:

```ts
export function logout() {
  localStorage.clear();
  sessionStorage.clear();
  // El logout central invalida la sesión en TODOS los sistemas
  window.location.href = `${URL_ADMINCENTRAL}/logout?redirect=${
    encodeURIComponent(window.location.origin)
  }`;
}
```

> Las cookies `sso_*` las puso el backend con `HttpOnly` (la de refresh) y
> `path=/`. El JS no puede borrar la de refresh: por eso el logout tiene que
> pasar por admincentral.

---

# Parte C — Checklist

### Backend

- [ ] `core/` copiado a la raíz, **sin** `__init__.py` en `core/`
- [ ] `python -c "import core.sso"` funciona
- [ ] Dependencias instaladas (incluida `cryptography`)
- [ ] `core.sso`, `core.permisos`, `core.auditoria` en `INSTALLED_APPS`
- [ ] Bloque de settings de A5 copiado
- [ ] **`SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", ...) == "True"` presente**
- [ ] `CACHES` apunta a Redis real (no LocMemCache)
- [ ] `.env` completo, con `SSO_SYSTEM_SLUG` idéntico al de admincentral
- [ ] URLs montadas con `+ sso_urlpatterns` (no `include()`)
- [ ] `python manage.py migrate permisos`
- [ ] `core/permisos/codigos.py` con **tus** permisos
- [ ] `python manage.py generar_permisos` corrido
- [ ] Resolver `me` implementado
- [ ] Resolvers protegidos, con `@RegistrarActividad` como más interno
- [ ] Servidor corriendo bajo ASGI (uvicorn)
- [ ] Contenedor unido a las dos redes de admincentral
- [ ] Sistema registrado con Callback OIDC → **ruta del frontend**
- [ ] Logs muestran `SSOEventConsumer: conectado`

### Frontend

- [ ] Ruta `/sso-callback` implementada, con guarda anti doble ejecución
- [ ] Todas las llamadas con `credentials: "include"`
- [ ] Wrapper con renovación + reintento único
- [ ] `SSO_SESSION_REVOKED` cierra sesión sin intentar renovar
- [ ] `AuthProvider` cargando `me` al arrancar
- [ ] `src/auth/permisos.ts` espejo de `codigos.py`
- [ ] UI condicionada con `puede(...)`
- [ ] `useSSEPermisos()` montado una sola vez, con `es.close()` al desmontar
- [ ] Listener de `session_revoked` registrado, además del de `permission_change`
- [ ] Nada de tokens en `localStorage`

---

# Parte D — Troubleshooting

### "Sesión Inválida" apenas termina el login

**Causa 1 — falta la línea de `SSO_COOKIE_SECURE`.** Es la más frecuente. El
paquete no lee `USE_HTTPS`; sin la línea de A5, las cookies salen con
`Secure=True` y sobre HTTP el navegador las descarta sin avisar.

```python
SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", "False") == "True"
```

**Causa 2 — falta `credentials: "include"`** en el `fetch` del callback.

**Diagnóstico:** DevTools → Application → Cookies. Si `sso_access_token` no
aparece después del login, es una de estas dos.

---

### El navegador muestra JSON o una página en blanco tras el login

La **URL Callback OIDC** en admincentral apunta al backend en vez del frontend.

| ❌ | ✅ |
|---|---|
| `http://host:8000/api/sso/callback` | `http://host:5173/sso-callback` |

Corregir en admincentral → Sistemas → editar → pestaña SSO → **Regenerar claves SSO**.

---

### `Cannot return null for non-nullable field ...id`

Algún campo `str` no-opcional de tu tipo GraphQL quedó en `None`. Casi siempre
es `me` sin fallback a `""`. Ver la advertencia de A11.

También pasa con cookies viejas de antes de migrar al SSO: pedile al usuario
que borre cookies y vuelva a entrar.

---

### El usuario entra pero no tiene ningún permiso

Los permisos viven en Redis, no en el token. Revisá en orden:

```bash
# 1. ¿Llegaron a Redis en el login?
python manage.py shell -c "
from core.sso import get_local_perms; print(get_local_perms('<rol_id>'))"
```

- **Devuelve `None`** → el IdP no mandó `permissions` en el exchange, o Redis no
  es compartido entre workers. Verificá que `CACHES` sea `django_redis`, no
  LocMemCache.
- **Devuelve `[]`** → el rol no tiene permisos asignados en admincentral para
  tu sistema.
- **Devuelve códigos distintos a los tuyos** → el prefijo no coincide. Corré
  `generar_permisos` y verificá que el admin haya asignado *esos* códigos.

```bash
# 2. ¿El slug coincide?
# El evento AMQP trae permissions_by_app[slug]. Si tu SSO_SYSTEM_SLUG no
# coincide con la clave que manda admincentral, nunca se guardan permisos.
```

---

### Los permisos no se actualizan en caliente

```bash
# ¿El consumer está vivo?
docker exec admincentral-rabbitmq rabbitmqctl list_queues name messages consumers
```

- **`consumers = 0`** → el consumer no corre. Causas: `SSO_AMQP_URL` vacía, el
  proceso no es un servidor web, o credenciales mal (el usuario es
  `admincentral`, **no** `admin` — da `403 ACCESS_REFUSED`).
- **`messages` creciendo** → llegan pero fallan al procesarse. Revisá los logs
  por `SSOConsumer: error procesando mensaje`.

Los mensajes no se pierden: la cola es durable y se drenan al reconectar.

---

### Revoco una sesión y el usuario sigue trabajando

Revisá la cadena en orden — cada paso tiene su propia comprobación:

```bash
# 1. ¿Llegó el evento y quedó la marca en tu Redis?
python manage.py shell -c "
from core.sso import motivo_revocacion; print(motivo_revocacion('<user_id>'))"
# Esperado: 'idle', 'revocada', o el motivo que haya mandado admincentral.
# None → el evento no llegó: revisá el consumer (sección anterior).
```

```bash
# 2. ¿El validator corta? Con un token emitido ANTES de la revocación:
curl -s -X POST http://localhost:8000/graphql \
  -H "Cookie: sso_access_token=<token_viejo>" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ me { id } }"}'
# Esperado: extensions.code = "SSO_SESSION_REVOKED"
```

Si el paso 1 da el motivo pero el paso 2 no corta, tu backend tiene
`core/sso/validator.py` desactualizado (sin el paso 0). Si el paso 2 corta pero
el navegador no reacciona, falta el listener de `session_revoked` en el
frontend (B7) o el manejo del código en el wrapper (B4).

---

### Un usuario re-logueado sigue bloqueado

Síntoma: revocaste la sesión, el usuario vuelve a entrar por el SSO y sigue
recibiendo `SSO_SESSION_REVOKED`.

**Causa:** `core/sso/state.py` desactualizado — `seed_from_jwt` no borra la
marca de revocación, así que sobrevive al re-login hasta que expira (24 h).

**Comprobación:**

```bash
python manage.py shell -c "
from core.sso.state import seed_from_jwt, marcar_sesion_revocada, sesion_revocada
marcar_sesion_revocada('prueba', 'idle')
seed_from_jwt({'sub': 'prueba', 'rol_id': 'r', 'pv': 1, 'dv': 1})
print('OK' if not sesion_revocada('prueba') else 'state.py DESACTUALIZADO')"
```

**Desbloqueo inmediato** mientras actualizás el paquete:

```bash
python manage.py shell -c "
from core.sso import limpiar_revocacion; limpiar_revocacion('<user_id>')"
```

---

### El SSE se corta cada pocos segundos

- Corré con **uvicorn**, no gunicorn WSGI.
- Con gunicorn, worker uvicorn y `--timeout 0`.
- Detrás de Nginx: `proxy_buffering off;` y `proxy_read_timeout 3600;`
  (el backend ya manda `X-Accel-Buffering: no`).

---

### La bitácora no está registrando

Primero, mirá su estado — no hace falta adivinar:

```bash
python manage.py shell -c "
from core.auditoria import estado; print(estado())"
```

```python
{'operativa': True,  'desactivada': False, 'caida_hace_s': 0,
 'eventos_descartados': 0, 'proximo_reintento_en_s': 0}
```

| Qué ves | Qué significa |
|---|---|
| `desactivada: True` | Falta `AUDITORIA_RABBIT_URL`. Configurala y reiniciá |
| `caida_hace_s > 0` | RabbitMQ no responde. Se reintenta solo en `proximo_reintento_en_s` |
| `eventos_descartados > 0` | Cuántos registros se perdieron en esta caída |
| `operativa: True` | La bitácora publica bien: el problema está del lado del consumidor de la cola |

**Se recupera sola.** El backoff va de 30 s a 5 min; en cuanto RabbitMQ vuelve,
la bitácora se reactiva sin intervención. En el log vas a ver la ventana completa:

```
WARNING [Bitácora] RabbitMQ no disponible (...). Reintento en 30 s. Los eventos
        de auditoría se pierden mientras tanto.
WARNING [Bitácora] RabbitMQ sigue sin responder (...). Caída hace 90 s,
        43 eventos descartados. Próximo reintento en 120 s.
WARNING [Bitácora] RabbitMQ recuperado tras 154 s de caída. 71 eventos de
        auditoría se perdieron en esa ventana.
```

Para no esperar al backoff después de arreglar RabbitMQ:

```bash
python manage.py shell -c "
from core.auditoria import reiniciar_conexion; reiniciar_conexion()"
```

> ⚠ Lo que se descartó durante la caída **no se recupera**: no hay buffer en
> disco. Si el log reporta eventos perdidos, esa ventana de auditoría tiene un
> hueco y conviene dejarlo asentado.

---

### `@RegistrarActividad` lanza `ValueError` al arrancar

Lo usaste sin descripción. La descripción es obligatoria:

```python
@RegistrarActividad("creacion de solicitud")     # ✅
```

---

### Los intentos fallidos no aparecen en la bitácora

`@RegistrarActividad` no es el decorador más interno. Tiene que ir pegado al
`def`, debajo de los guards. Ver A10.

---

# Parte E — Limitaciones conocidas

Cosas que el paquete **no** hace en esta versión. Conocelas antes de prometer
comportamiento al usuario final.

| # | Limitación | Impacto para vos |
|---|---|---|
| 1 | **El endpoint SSE no verifica la firma del token** | No mandes datos sensibles por ese canal. Hoy solo dice "hubo un cambio" |
| 2 | **La bitácora no guarda el estado "antes/después"** de una edición, aunque los manuales viejos lo afirmen | Si necesitás trazabilidad de cambios de campos, hay que implementarla |
| 3 | **Rotación de clave RSA sin soporte.** La clave se lee de `JWT_LLAVE_PUBLICA` | Cuando admincentral rote su clave, hay que actualizar el `.env` y reiniciar |
| 4 | **Los decoradores son síncronos** | No los uses con resolvers `async def`: la auditoría registraría "exitoso" antes de que el resolver corra |
| 5 | **Reiniciar Redis anula las revocaciones pendientes** (fail-open documentado) | Un token revocado vuelve a pasar tras un `FLUSHDB` |

El detalle técnico de cada una, y dónde intervenir, está en
[`README.md` §6](./README.md).

---

*Paquetes core UAGRM — versión 2.0.0*
