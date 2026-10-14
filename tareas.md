# Control de Tareas y Plan de Trabajo — Sistema de Digitalización de Archivos

> **Arquitectura actual:** Single-tenant (sin unidades, `codigo` y `slug` únicos globales), clasificación local determinista (normalización + fuzzy + score, sin dependencias de IA externa), Django 4.2 + Strawberry GraphQL, PostgreSQL, MinIO, React 18 + Vite + TypeScript.

---

# 🚀 NUEVA ETAPA: Tareas Pendientes y Mejoras por Aplicar

Esta sección concentra todo el trabajo pendiente, priorizado y detallado para guiar las siguientes fases de desarrollo.

---

## 📌 Sub-etapa 1: Bugs Críticos y Lógica de Frontend (Prioridad: 🔴 Alta) — ✅ COMPLETADA (2026-10-13)

### 1.1 Casillero — Soporte para múltiples documentos por tipo (Fase 15.D)
* **Problema:** En `CasilleroDocumentos.tsx`, la función `getDocumentoForTipo` devuelve exclusivamente el primer documento asociado a cada tipo. Si una persona tiene varios folios del mismo tipo (ej. certificados de varios años, libretas de notas múltiples), los documentos adicionales quedan ocultos.
* **Archivos afectados:**
  * `subida-frontend/src/modules/personas/pages/CasilleroDocumentos.tsx`
* **Tareas a realizar:**
  - [x] Reemplazar la búsqueda de un único documento por una agrupación `tipoId → Documento[]`.
  - [x] Renderizar todas las páginas o folios asociados a cada tipo (mediante miniatura principal con indicador `+N` o lista/mini-cards desplegables por tipo).
  - [x] Mantener las acciones independientes por cada documento (abrir en visor, reasignar tipo).

---

### 1.2 Dashboard — Ordenamiento cronológico de "Últimas Personas Registradas" (Fase 15.E)
* **Problema:** En `Dashboard.tsx`, la tabla de últimas personas registradas muestra los registros según el orden por defecto del modelo (`codigo`), y no por la fecha real de creación.
* **Archivos afectados:**
  * `subida-backend/apps/personas/schema.py`
  * `subida-frontend/src/shared/graphql/queries/personas.ts`
  * `subida-frontend/src/modules/auth/pages/Dashboard.tsx`
* **Tareas a realizar:**
  - [x] Agregar el argumento opcional `orderBy: Optional[str] = None` al resolver de personas en GraphQL con whitelist segura (`created_at`, `-created_at`, `codigo`, `-codigo`, `nombres`, `-nombres`).
  - [x] Actualizar el query `GET_PERSONAS` en frontend para recibir `$orderBy: String`.
  - [x] Configurar el card de últimas personas en `Dashboard.tsx` con `orderBy: "-created_at"`.

---

### 1.3 Subida — Bloqueo de nombres de archivo inválidos (Fase 15.F)
* **Problema:** En `SubirDocumentos.tsx`, la interfaz advierte visualmente si un archivo tiene un nombre no conforme, pero el botón de subida permanece habilitado. Si el usuario procede, los archivos inválidos se envían al backend generando errores HTTP.
* **Archivos afectados:**
  * `subida-frontend/src/modules/documentos/pages/SubirDocumentos.tsx`
* **Tareas a realizar:**
  - [x] Deshabilitar el botón de subida cuando haya uno o más archivos con formato inválido o advertencia crítica.
  - [x] Excluir automáticamente del envío cualquier archivo que no cumpla con el formato requerido.

---

### 1.4 Documentos Pendientes — Estado de carga y feedback en asignación (Fase 15.G)
* **Problema:** En `DocumentosPendientes.tsx`, la función `handleAsignar` carece de manejo de estados por fila y `try/catch`, lo que impide informar al usuario si una asignación individual falla.
* **Archivos afectados:**
  * `subida-frontend/src/modules/documentos/pages/DocumentosPendientes.tsx`
* **Tareas a realizar:**
  - [x] Envolver `handleAsignar` en un bloque `try/catch` con notificación de error vía toast/alerta.
  - [x] Controlar estado de carga (`loading`) específico por fila o documento para evitar doble envío.

---

## 📌 Sub-etapa 2: Seguridad y Autenticación en Backend (Prioridad: 🟠 Alta) — ✅ COMPLETADA (2026-10-13)

### 2.1 Autenticación Real en Servidor y Contexto GraphQL (Fase 5 Refinamiento)
* **Problema:** El backend emite tokens de prueba (`token-{user.id}`) y la vista GraphQL no valida la sesión ni inyecta el usuario autenticado en `info.context`. Por ello, `_usuario_de(info)` devuelve `None`, impidiendo auditar quién reclasifica documentos. Las guardas en frontend (`ProtectedRoute`) solo proveen control visual pero no seguridad.
* **Archivos afectados:**
  * `subida-backend/apps/users/tokens.py`
  * `subida-backend/apps/users/middleware.py`
  * `subida-backend/config/urls.py`
  * `subida-backend/apps/documentos/mutations.py`
  * `subida-frontend/src/shared/contexts/AuthContext.tsx`
* **Tareas a realizar:**
  - [x] Implementar autenticación real para la API GraphQL (firmado HMAC-SHA256 con `django.core.signing` y Bearer token sin librerías externas).
  - [x] Inyectar el usuario autenticado en el contexto de Strawberry (`info.context.request.user`).
  - [x] Registrar el usuario autenticado real en `Documento.historial_clasificacion` al ejecutar `reclasificarDocumento`.

---

## 📌 Sub-etapa 3: Clasificador — Feedback Loop de Keywords (Prioridad: 🟡 Media) — ✅ COMPLETADA (2026-10-13)

### 3.1 Sugerencia Automática de Keywords Basada en Correcciones Humanas (Fase 7 Refinamiento)
* **Objetivo:** Analizar los documentos verificados por humanos para sugerir de forma estadística nuevas palabras clave y pesos para cada `TipoDocumento`, sin intervención de IA externa.
* **Archivos afectados:**
  * `subida-backend/apps/documentos/models.py`
  * `subida-backend/apps/documentos/management/commands/sugerir_keywords.py`
  * `subida-backend/apps/documentos/schema.py`
  * `subida-backend/apps/documentos/mutations.py`
  * `subida-frontend/src/modules/configuracion/pages/TiposDocumento.tsx`
* **Tareas a realizar:**
  - [x] Crear el modelo `SugerenciaKeyword(tipo_documento, palabra, ratio, frecuencia, aceptada=None, created_at)`.
  - [x] Implementar el comando `python manage.py sugerir_keywords` (single-tenant):
    * Filtrar documentos con `estado='verificado'`.
    * Calcular frecuencia de términos contra otros tipos de documento tras aplicar `normalizar()`.
    * Proponer las palabras con mayor ratio que no figuren en `palabras_clave`.
    * Exigir un mínimo de documentos verificados (ej. ≥ 10) o emitir advertencia.
  - [x] Exponer query `sugerenciasKeyword(tipoDocumentoId: ID!)` y mutation `aceptarSugerencia(id: ID!, peso: Int!)`.
  - [x] Agregar en la vista de edición de `TipoDocumento` un panel para revisar sugerencias pendientes con opciones "Aceptar" y "Descartar".

---

## 📌 Sub-etapa 4: Infraestructura y Deuda Técnica (Prioridad: 🟢 Baja) — ✅ COMPLETADA (2026-10-13)

### 4.1 Resolución de Proxy en Docker Desktop (Fase 10)
* **Problema:** El entorno de Docker Desktop con proxy interno (`http.docker.internal:3128`) puede interrumpir peticiones durante la construcción de imágenes.
* **Tareas a realizar:**
  - [x] Desactivar la configuración manual de proxy en Docker Desktop (o configurar proxy explícito en el Dockerfile si es requerido por el host).
  - [x] Validar arranque completo con `docker compose up --build`.

### 4.2 Tipado GraphQL Estricto en `keywordsObligatorias`
* **Problema:** `TipoDocumento.keywords_obligatorias` se expone en Strawberry GraphQL como `JSON!` en lugar de `[String!]`, forzando conversiones manuales en frontend.
* **Archivos afectados:**
  * `subida-backend/apps/documentos/schema.py`
* **Tareas a realizar:**
  - [x] Tipar explícitamente `keywords_obligatorias: List[str]` en el tipo Strawberry.

### 4.3 Squash de Migraciones Históricas
* **Problema:** La carpeta vacía `subida-backend/apps/unidades` debe permanecer en `INSTALLED_APPS` porque migraciones antiguas dependen de ella.
* **Tareas a realizar:**
  - [x] Realizar squash de las migraciones históricas para eliminar por completo la app `apps/unidades`.

## 📌 Sub-etapa 5: Endurecimiento Operativo y UX para Usuarios Finales — ✅ COMPLETADA (2026-10-14)

### 5.1 Disparador Visual de Sugerencias de Keywords (Sin Terminal)
* **Objetivo:** Permitir a un usuario no técnico disparar el análisis estadístico de sugerencias de palabras clave directamente desde la interfaz con un clic.
* **Implementación:**
  - [x] Lógica estadística modularizada en `services.py:generar_sugerencias_keywords(min_docs, top, limpiar)`.
  - [x] Mutation GraphQL `generarSugerenciasKeywords(minDocs: Int!, top: Int!, limpiar: Boolean!)` en Strawberry.
  - [x] Botón "Buscar Nuevas Palabras Clave" con spinner, feedback de folios procesados y sugerencias encontradas en `TiposDocumento.tsx`.

---

### 5.2 Rediseño del Dashboard Enfocado en Digitalización
* **Objetivo:** Convertir el Dashboard en un centro de supervisión operativa 100% enfocado en folios, métricas de clasificación y colas de revisión (las personas se sincronizan vía API externa).
* **Implementación:**
  - [x] Tipo GraphQL `EstadisticasDigitalizacionType` y query `estadisticasDigitalizacion` calculada en una sola agregación SQL.
  - [x] Query `documentosRecientes(limit: Int)` para auditar las últimas páginas procesadas.
  - [x] Rediseño de `Dashboard.tsx` con cards de KPIs (Total folios, % Efectividad con progress bar, Folios en revisión humana, Palabras clave sugeridas), desglose visual por estado, tabla de últimos folios y accesos rápidos directos a colas.

---

### 5.3 Paginación Estricta en Consultas y Vistas
* **Objetivo:** Evitar consultas desbordadas `SELECT *` en tablas y vistas del frontend.
* **Implementación:**
  - [x] Parámetros `limit: Optional[int]` y `offset: int = 0` en `documentosPendientes`.
  - [x] Controles de paginación (Página anterior, siguiente, indicador de tanda) en `DocumentosPendientes.tsx`.
  - [x] Bloque de paginación y carga al pie en las tres colas de revisión (`RevisionDudosas.tsx`, `RevisionSinClasificar.tsx`, `RevisionDuplicados.tsx`).

---

### 5.4 Carga Progresiva / Asíncrona de PDFs Multi-Página
* **Objetivo:** Evitar bloqueos de interfaz y ofrecer feedback en tiempo real para usuarios no técnicos al procesar expedientes de múltiples páginas.
* **Implementación:**
  - [x] Carga y procesamiento progresivo archivo por archivo en `SubirDocumentos.tsx`.
  - [x] Barra de progreso visual porcentual y badges de estado por archivo (`pendiente`, `procesando`, `completado`, `error`).
  - [x] Resumen en vivo de páginas segmentadas y enlaces directos al casillero de cada persona.

---

## 📌 Sub-etapa 6: Arquitectura Modular Empresarial en Frontend (Prioridad: 🟢 Alta) — ✅ COMPLETADA (2026-10-14)

### 6.1 Refactorización a Arquitectura Limpia Modular
* **Objetivo:** Reestructurar el frontend (`subida-frontend`) bajo un estándar modular empresarial desacoplado con aislamiento funcional por dominio, tipado estricto y enrutador componible.
* **Implementación:**
  - [x] **Fase 1: Configuración, Entorno y Rutas:** Creación de `.env.example`, `.env.development`, `.env.production`, `environment.ts`, `constants.ts`, `routes.ts` y aliases en `tsconfig.json`/`vite.config.ts` (`@config`, `@modules`, `@graphql`, `@app-types`, `@shared`, `@`).
  - [x] **Fase 2: Capa Global de GraphQL y Tipado Centralizado:** Reorganización en `src/graphql/` (`client.ts`, `queries/`, `mutations/`, `fragments/`) y `src/types/` (`common`, `persona`, `tipo-documento`, `documento`, `graphql`), con forwarders de compatibilidad.
  - [x] **Fase 3: Modularización de `shared/`:** Descomposición atómica de layout (`Sidebar`, `Header`, `Footer`, `Layout`), guards (`AuthGuard`, `RoleGuard`), utilitarios (`validators`, `formatters`, `helpers`) y assets.
  - [x] **Fase 4: Módulos `auth` y `configuracion`:** Subcarpetas estructuradas `components/[Component]/[Component].tsx` + `types.ts`, `services/`, `types/`, `pages/` y `routes/`.
  - [x] **Fase 5: Módulos `documentos`, `revision` y `personas`:** Extracción de componentes especializados (`FileDropzone`, `UploadQueue`, `UploadProgress`, `UploadResultSummary`, `DocumentoViewerModal`, `PendientesPersonaGroup`, `RevisionItemCard`, `VisorRevision`, `EstadoDocumentoBadge`, `TipoDocumentoCard`, `PersonaTable`, `PersonaForm`), servicios dedicados y forwarders transparentes.
  - [x] **Fase 6: Enrutador Centralizado y Limpieza:** Composición del enrutador central `src/config/routes.tsx` a partir de los arrays de rutas exportados por cada módulo (`authRoutes`, `personasRoutes`, `documentosRoutes`, `revisionRoutes`, `configuracionRoutes`), barrel exports en `src/modules/index.ts` y validación completa de build y suite de pruebas.

---

# 📜 HISTORIAL DE FASES COMPLETADAS

| Fase / Tarea | Resumen de Implementación | Fecha |
|---|---|---|
| **Fase 7: Formulario TipoDocumento** | Formulario en dos niveles, auto-asignación de peso `:3` y unificación de diálogo crear/editar. | 2026-10-04 |
| **Fase 8: Simplificación TipoDocumento** | Eliminación de campos técnicos avanzados (`requiere`, `excluye`, `score_minimo`, `orden`, `es_obligatorio`). Clasificación únicamente por score. | 2026-10-04 |
| **Fase 9: Visor de Documentos** | Vista de personas con indicador clasificado y visor de documentos con thumbnails difuminados e iframe responsivo con opción de impresión. | 2026-10-09 |
| **Fase 11: Docker Compose Fix** | Remoción de `gcc` y `libpq-dev` innecesarios gracias a `psycopg2-binary`. | 2026-10-05 |
| **Fase 12: Corrección de Rutas Frontend** | Unificación y corrección de rutas rotas (`/personas/registrar`, `/casillero`, `/vista-persona`). | 2026-10-05 |
| **Fase 15 (A y B): Auth y Rutas** | Corrección de fallo de navegación en `Login.tsx`, implementación de `AuthContext` y `ProtectedRoute`. | 2026-10-05 |
| **Fase 16: Migración Strawberry GraphQL** | Sustitución completa de Graphene-Django por Strawberry GraphQL (`strawberry-graphql-django`). Contrato de queries y mutaciones preservado con suite de tests. | 2026-10-05 |
| **Fase 17: Eliminación de Unidades (Single-Tenant)** | Eliminación absoluta del modelo `Unidad`. Claves `codigo` y `slug` únicas a nivel global. Eliminación de selectores, contextos y referencias en frontend y backend. | 2026-10-09 |
| **Refinamiento 3: Clasificador Robusto** | Normalización de texto NFKD, búsqueda por frases y matching difuso con `rapidfuzz` (`UMBRAL_FUZZY = 75`) tolerante a OCR sucio. | 2026-10-05 |
| **Refinamiento 4: Modelo de Clasificación** | Persistencia de `score`, `keywords_matcheadas`, campo `keywords_obligatorias` y nuevos estados `dudosa` y `sin_clasificar`. | 2026-10-05 |
| **Refinamiento 5: Colas de Revisión** | Rutas `/revision/dudosas` y `/revision/sin-clasificar`, mutation `reclasificarDocumento` y registro de auditoría en `historial_clasificacion`. | 2026-10-05 |
| **Refinamiento 6: Deduplicación por pHash** | Cálculo de `pHash` con `imagehash` en memoria, detección con distancia Hamming ≤ 5 y cola de revisión `/revision/duplicados`. | 2026-10-05 |
| **Nueva Etapa - Sub-etapa 1: Frontend** | Casillero multi-documento (`+N` folios, drawer y visor independiente), orden cronológico en dashboard, bloqueo de archivos inválidos en subida y manejo robusto de errores con loading en documentos pendientes. | 2026-10-13 |
| **Nueva Etapa - Sub-etapa 2: Auth y Contexto** | Tokens criptográficos HMAC-SHA256 con `django.core.signing` (7 días), `BearerAuthMiddleware` inyectando usuario autenticado a Strawberry context, y trazabilidad real de auditoría en `historial_clasificacion`. | 2026-10-13 |
| **Nueva Etapa - Sub-etapa 3: Feedback Loop** | Modelo `SugerenciaKeyword`, comando `sugerir_keywords` con cálculo estadístico y stopwords, queries/mutations GraphQL `sugerenciasKeyword`, `aceptarSugerencia`, `descartarSugerencia`, y panel interactivo en `TiposDocumento.tsx`. | 2026-10-13 |
| **Nueva Etapa - Sub-etapa 4: Deuda Técnica** | Tipado estricto `[String!]!` en `keywordsObligatorias`, squash limpio de migraciones históricas en `personas` y `documentos` eliminando por completo la app `apps/unidades` de `INSTALLED_APPS` y disco, y verificación de build y stack Docker. | 2026-10-13 |
| **Nueva Etapa - Sub-etapa 5: Operatividad y UX** | Disparador visual de sugerencias de keywords, rediseño completo del Dashboard con métricas de digitalización, paginación estricta y carga progresiva con feedback paso a paso. | 2026-10-14 |
| **Nueva Etapa - Sub-etapa 6: Refactor Modular** | Reestructuración total a arquitectura modular limpia: centralización de config/types/graphql, descomposición atómica de shared, desacoplamiento de componentes en 5 módulos (`auth`, `configuracion`, `documentos`, `revision`, `personas`), rutas modulares y forwarders 100% retrocompatibles. | 2026-10-14 |


---

# 🚫 REGISTRO DE FASES Y ENFOQUES OBSOLETOS / ELIMINADOS

1. **Soporte Multi-Unidad (Fases 1 a 6 iniciales, Refinamiento 1 y 15.C):**
   * *Motivo de eliminación:* Por requerimiento del proyecto, la gestión multi-tenant fue descartada íntegramente en la **FASE 17**. El sistema ahora opera como un catálogo único y global con personas y tipos de documentos independientes de cualquier unidad organizacional.
2. **Dependencia e Integración de IA / Gemini (Fases 13, 14 y Refinamiento 2):**
   * *Motivo de eliminación:* Se determinó prescindir de dependencias externas a APIs de IA y Gemini (`google-genai`). Toda la clasificación y análisis documental se realiza de manera 100% local, rápida y determinista mediante el algoritmo de normalización, fuzzy scoring y deduplicación pHash.

---

# 📋 Reglas Globales para la Ejecución de Tareas

1. **Una tarea a la vez:** Completar y validar cada punto antes de avanzar al siguiente.
2. **Integridad de directorios:** No tocar ni modificar la carpeta `core/` raíz bajo ninguna circunstancia.
3. **Control de dependencias:** No añadir nuevas librerías a menos que estén expresamente justificadas en el plan.
4. **Respeto a la arquitectura:** Mantener Django 4.2 + Strawberry GraphQL, PostgreSQL, MinIO y React + TypeScript. No migrar a REST endpoints que ya estén tipados en GraphQL.
5. **Actualización del archivo:** Al finalizar una tarea, marcarla con `[x]` en este documento, registrar la fecha y documentar cualquier desviación relevante.