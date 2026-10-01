# Prompt para integrar los paquetes core en un proyecto externo

Copiá el bloque de abajo y pegalo en una sesión de Claude Code **abierta en el
proyecto destino**, con la carpeta `core/` ya copiada en la raíz del proyecto
(o disponible para copiar).

Ajustá las tres líneas de `CONTEXTO DEL PROYECTO` antes de enviarlo. Lo demás
funciona tal cual.

---

```
Vas a integrar los paquetes core de UAGRM (SSO, permisos y auditoría) en este
proyecto. Son tres paquetes Django reutilizables que ya existen y están
probados: NO los reescribas ni modifiques su código interno.

## CONTEXTO DEL PROYECTO
- Nombre / slug del sistema en admincentral: <completar, ej. sistema-titulos>
- ¿Ya tiene una integración SSO previa (carpetas core/autenticacion,
  core/uagrm_sso, core/permissions, core/bitacora)?: <sí / no>
- ¿El frontend React está en este mismo repositorio?: <sí / no / ruta>

## ANTES DE ESCRIBIR NADA

1. Leé `core/GUIA-INTEGRACION.md` completo. Es la fuente de verdad: tiene los
   bloques de settings, los endpoints reales y las trampas conocidas. Si algo
   de este prompt contradice esa guía, gana la guía.
2. Leé `core/README.md` §6 para saber qué limitaciones tiene el paquete, y no
   prometer comportamiento que no existe.
3. Explorá el proyecto y reportame en 10 líneas:
   - Dónde está el settings (¿un archivo o un paquete `settings/`?)
   - Si usa Strawberry GraphQL y dónde están los Query/Mutation
   - Si corre bajo ASGI (uvicorn) o WSGI
   - Qué backend de cache tiene configurado
   - Si ya existe alguna autenticación propia que esto vaya a reemplazar
4. NO empieces a editar hasta que yo confirme el plan.

## FASES

### Fase 1 — Backend base
- Copiar `core/` a la raíz del proyecto, al lado de `manage.py`.
- Agregar `core.sso`, `core.permisos`, `core.auditoria` a INSTALLED_APPS.
- Agregar el bloque de settings de la guía (§A5), adaptado a cómo este
  proyecto lee variables de entorno.
- Agregar las variables al `.env` y al `.env.example` si existe.
- Montar las URLs.
- Correr `python manage.py migrate permisos`.

### Fase 2 — Catálogo de permisos
- Leé todos los resolvers del proyecto y proponeme un catálogo de permisos
  AGRUPADO POR CAPACIDAD, no uno por método. Apuntá a entre 5 y 15 permisos
  que un administrador pueda entender y configurar.
- Mostrame la propuesta (código, nombre, descripción, qué resolvers cubre) y
  esperá mi aprobación ANTES de escribir `core/permisos/codigos.py`.
- Recién con mi OK, escribí el catálogo y corré
  `python manage.py generar_permisos --conservar-obsoletos`.

### Fase 3 — Proteger resolvers
- Aplicar los guards a cada Query y Mutation, usando las constantes de
  `Permisos`, nunca strings literales.
- Implementar el resolver `me` (guía §A11). Es obligatorio: sin él el
  frontend no puede saber qué permisos tiene el usuario.
- Si algún resolver es ambiguo (no está claro qué permiso le corresponde),
  listámelo y preguntame en vez de adivinar.

### Fase 4 — Frontend
- Si el frontend está en este repo: implementar la ruta `/sso-callback`, el
  wrapper de sesión con códigos de error, el AuthProvider con `me`, y el hook
  de SSE con los DOS listeners (`permission_change` y `session_revoked`).
- Si NO está en este repo: no inventes nada. Generá un archivo
  `INTEGRACION-FRONTEND.md` en la raíz con lo que el equipo de frontend tiene
  que hacer, sacado de la Parte B de la guía, ya adaptado a este sistema
  (rutas reales, nombre del sistema, códigos de permiso reales).

### Fase 5 — Verificación
- Correr `python -c "import core.sso, core.permisos, core.auditoria"`.
- Correr `python manage.py check`.
- Levantar el servidor y confirmar en los logs que aparece
  `SSOEventConsumer: conectado` (o que dice explícitamente que SSO_AMQP_URL
  está vacía, si todavía no la configuraron).
- Verificar que `core/` NO tenga `__init__.py`.
- Reportarme qué verificaste de verdad y qué no pudiste probar por falta de
  acceso (RabbitMQ, Redis, admincentral). No digas "listo" sobre algo que no
  ejecutaste.

## REGLAS QUE NO SE NEGOCIAN

Estas son errores reales que ya pasaron. No las descubras de nuevo:

1. `core/` NO lleva `__init__.py`. Es un namespace package. Las subcarpetas sí.
2. Las URLs se suman con `+ sso_urlpatterns`, NUNCA con
   `path("sso/", include(...))`. Las rutas ya traen el prefijo `api/sso/`
   adentro; con `include()` queda `/sso/api/sso/callback` y el callback deja
   de coincidir con el registrado en admincentral.
3. El paquete NO lee `USE_HTTPS`. Si el proyecto usa esa variable, hay que
   cablearla explícitamente:
   `SSO_COOKIE_SECURE = os.getenv("USE_HTTPS", "False") == "True"`
   Sin esa línea el login falla en silencio sobre HTTP.
4. `CACHES["default"]` tiene que ser Redis compartido (`django_redis`), NUNCA
   LocMemCache. Con cache local cada worker tendría permisos distintos.
5. `@RegistrarActividad` requiere una descripción en texto y debe ser el
   decorador MÁS INTERNO, pegado al `def`. Sin descripción lanza ValueError
   en tiempo de import. El orden correcto es:
   `@strawberry.mutation` / `@RequiereAutenticacion` / `@RequierePermiso(...)`
   / `@RegistrarActividad("...")` / `def ...`
6. Todo resolver protegido necesita el parámetro `info: strawberry.Info`.
7. En el resolver `me`, todo campo `str` no-opcional necesita fallback a `""`.
   Si queda en `None`, GraphQL tumba la respuesta entera y el frontend muestra
   "sesión inválida" aunque el login haya funcionado.
8. `SSO_SYSTEM_SLUG` va con GUIONES (`sistema-titulos`) porque es el claim
   `aud` y el nombre de la cola. El prefijo de los códigos de permiso va con
   GUIONES BAJOS (`sistema_titulos_imprimir`). No los mezcles.
9. `generar_permisos` SIN flags BORRA de la tabla los permisos que no estén en
   el catálogo. Usá `--conservar-obsoletos` la primera vez.
10. Dejá `PERMISSIONS_CONFIG["auto_generate"] = False`. En True, cada arranque
    borra permisos.
11. El SSE necesita ASGI. Si el proyecto corre WSGI, avisame: hay que cambiar
    el arranque a uvicorn.

## SI EL PROYECTO YA TENÍA LA VERSIÓN VIEJA

Si existen `core/autenticacion`, `core/uagrm_sso`, `core/permissions` o
`core/bitacora`, es una migración, no una instalación nueva:

- Leé `core/README.md` §2, que tiene el mapa completo de imports viejos a
  nuevos.
- Actualizá TODOS los imports del proyecto. Buscá `core.autenticacion`,
  `core.uagrm_sso`, `core.permissions`, `core.bitacora` y no dejes ninguno.
- El app label pasa de `permissions` a `permisos`. Si la tabla `permisos` ya
  existe: `python manage.py migrate permisos --fake-initial`.
- Migrá el catálogo de permisos existente al nuevo `codigos.py` respetando los
  códigos EXACTOS que ya usa admincentral. Si cambian, los usuarios pierden
  sus permisos.
- NO borres las carpetas viejas hasta que la nueva funcione. Movelas a
  `_viejo/` o dejalas donde están y avisame.
- El frontend necesita cambios: los códigos de error y el listener de
  `session_revoked` son nuevos. Si no está en este repo, incluilo en el
  archivo de handoff.

## QUÉ NO HACER

- No modifiques el código dentro de `core/sso`, `core/permisos` ni
  `core/auditoria`. La única excepción es `core/permisos/codigos.py`, que ES
  el lugar donde va el catálogo de este sistema.
- No inventes valores para `SSO_API_KEY`, `SSO_SYSTEM_KEY` ni
  `JWT_LLAVE_PUBLICA`. Dejalos leyendo del `.env` y decime cuáles hay que
  pedirle a DTIC.
- No borres ni desactives la autenticación existente sin preguntarme primero.
- No hagas commit ni push salvo que te lo pida.
- No declares terminada una fase sin haberla ejecutado.

## CÓMO REPORTAR

Al terminar cada fase, decime en pocas líneas: qué archivos tocaste, qué
verificaste ejecutando de verdad, qué quedó pendiente y qué necesitás de mí
(credenciales, decisiones, accesos). Si algo no se pudo probar, decilo
explícitamente en vez de asumir que anda.
```

---

## Variante corta

Si el proyecto es simple y ya conocés el terreno, alcanza con esto:

```
Integrá los paquetes core de UAGRM en este proyecto siguiendo
`core/GUIA-INTEGRACION.md` al pie de la letra.

Antes de editar, explorá el proyecto y mostrame el plan.

Respetá especialmente: `core/` sin `__init__.py`; URLs con `+` y no con
`include()`; la línea `SSO_COOKIE_SECURE = os.getenv("USE_HTTPS",...) ==
"True"`; CACHES con Redis real; `@RegistrarActividad("texto")` siempre como
decorador más interno.

El catálogo de permisos de `core/permisos/codigos.py` proponémelo primero y
esperá mi aprobación antes de escribirlo.

Al final decime qué verificaste ejecutando y qué no pudiste probar.
```
