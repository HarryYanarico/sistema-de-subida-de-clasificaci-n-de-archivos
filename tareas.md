# Plan: Soporte para Múltiples Unidades Organizacionales

## FASE 1: Backend — Modelos y Migración ⛔ OBSOLETA (eliminada en FASE 17)

### 1.1 Nuevo modelo `Unidad`
**Archivo:** `backend/apps/unidades/models.py` (nuevo)

```python
class Unidad(models.Model):
    nombre = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    descripcion = models.TextField(blank=True, default="")
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]
        verbose_name_plural = "unidades"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.nombre)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nombre
```

- Crear `apps/unidades/apps.py` con `UnidadesConfig`
- Crear `apps/unidades/admin.py` para registrar en Django admin
- Crear `apps/unidades/__init__.py`
- Agregar `'unidades'` a `INSTALLED_APPS` en `config/settings.py`

### 1.2 FK de `TipoDocumento` → `Unidad`
**Archivo:** `backend/apps/documentos/models.py`

- Agregar campo: `unidad = models.ForeignKey('unidades.Unidad', on_delete=models.CASCADE, related_name='tipos_documento')`
- Cambiar `unique=True` en `slug` a `unique_together = ('slug', 'unidad')` en Meta
- Hacer que `slug` ya no sea `unique=True` a nivel global

### 1.3 FK de `Persona` → `Unidad`
**Archivo:** `backend/apps/personas/models.py`

- Agregar campo: `unidad = models.ForeignKey('unidades.Unidad', on_delete=models.CASCADE, related_name='personas')`
- Cambiar `unique=True` en `codigo` a `unique_together = ('codigo', 'unidad')` en Meta

### 1.4 Migración de datos
**Archivo:** `backend/apps/unidades/migrations/0002_migrar_datos_iniciales.py` (data migration)

```python
def forwards(apps, schema_editor):
    Unidad = apps.get_model('unidades', 'Unidad')
    unidad, _ = Unidad.objects.get_or_create(
        nombre="Dirección de Registro y Admisiones",
        defaults={"slug": "direccion-registro-admisiones", "activo": True}
    )
    Persona = apps.get_model('personas', 'Persona')
    Persona.objects.update(unidad=unidad)
    TipoDocumento = apps.get_model('documentos', 'TipoDocumento')
    TipoDocumento.objects.update(unidad=unidad)
```

### 1.5 Migraciones de esquema
- Generar migración para `unidades.Unidad`
- Generar migración para agregar FKs a `TipoDocumento` y `Persona`

---

## FASE 2: Backend — GraphQL ⛔ OBSOLETA (eliminada en FASE 17)

### 2.1 Nuevo `unidades/schema.py`
**Archivo:** `backend/apps/unidades/schema.py` (nuevo)

**Queries:**
| Query | Args | Retorna |
|---|---|---|
| `unidades` | `activo: Boolean` | Lista de unidades |
| `unidad` | `id: Int!` | Una unidad por ID |

**Mutations:**
| Mutation | Args | Descripción |
|---|---|---|
| `createUnidad` | `nombre!, descripcion` | Crear unidad (slug auto-generado) |
| `updateUnidad` | `id!, nombre, descripcion, activo` | Editar unidad |
| `deleteUnidad` | `id!` | Eliminar unidad (validar que no tenga personas) |

### 2.2 Modificar `personas/schema.py`
**Archivo:** `backend/apps/personas/schema.py`

- `personas` query: agregar argumento `unidad_id: Int` (requerido). Filtrar `Persona.objects.filter(unidad_id=unidad_id)`
- `createPersona` mutation: agregar argumento `unidad_id: Int!`
- `updatePersona` mutation: sin cambio (ya existe la persona)

### 2.3 Modificar `documentos/schema.py`
**Archivo:** `backend/apps/documentos/schema.py`

- `tiposDocumento` query: agregar argumento `unidad_id: Int` (requerido). Filtrar `TipoDocumento.objects.filter(unidad_id=unidad_id)`
- `documentosPendientes` query: agregar argumento `unidad_id: Int` (requerido). Filtrar documentos pendientes de personas de esa unidad
- `createTipoDocumento` mutation: agregar argumento `unidad_id: Int!`
- `updateTipoDocumento` mutation: sin cambio (ya tiene el ID)
- `clasificar_documento()` en `mutations.py`: pasar `unidad` al `_classify_local()` para que solo compare contra tipos de esa unidad

### 2.4 Modificar `documentos/views.py`
**Archivo:** `backend/apps/documentos/views.py`

- `UploadPDFView`: recibir `unidad_id` del POST, pasar la unidad a `PDFProcessor.process_pdf()`
- `UploadBatchPDFView`: recibir `unidad_id` del POST, pasar la unidad a `PDFProcessor.process_pdf()`

### 2.5 Modificar `pdf_processor.py`
**Archivo:** `backend/apps/storage/pdf_processor.py`

- `process_pdf()`: agregar parámetro `unidad`. Pasarlo a `_classify_local()`
- `_classify_local(text, unidad)`: filtrar `TipoDocumento.objects.filter(unidad=unidad, activo=True)` en vez de todos los activos
- `_classify_with_ai()`: pasar solo los nombres de tipos de la unidad específica

### 2.6 Modificar `config/schema.py`
**Archivo:** `backend/config/schema.py`

- Importar y agregar `UnidadQuery` y `UnidadMutation` al schema raíz

---

## FASE 3: Frontend — Contexto y Tipos ⛔ OBSOLETA (eliminada en FASE 17)

### 3.1 Nuevo tipo `Unidad`
**Archivo:** `frontend/src/types/index.ts`

```typescript
export interface Unidad {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  activo: boolean;
}
```

### 3.2 Nuevo contexto `UnidadContext`
**Archivo:** `frontend/src/contexts/UnidadContext.tsx` (nuevo)

```typescript
interface UnidadContextType {
  unidadActiva: Unidad | null;
  setUnidadActiva: (unidad: Unidad) => void;
  unidades: Unidad[];
  loading: boolean;
}
```

- Usa `useQuery(GET_UNIDADES)` para cargar unidades activas
- Persiste `unidadActiva` en `localStorage`
- Si solo hay una unidad, la selecciona automáticamente
- Si no hay unidades, muestra mensaje para crear la primera

### 3.3 Envolver App con UnidadProvider
**Archivo:** `frontend/src/App.tsx`

- Importar `UnidadProvider` y envolver `<Layout>` con él
- La selección de unidad solo se muestra después del login

---

## FASE 4: Frontend — Queries y Mutations ⛔ OBSOLETA (eliminada en FASE 17)

### 4.1 Nuevo archivo `graphql/queries/unidades.ts`

```graphql
query GetUnidades($activo: Boolean) {
  unidades(activo: $activo) {
    id
    nombre
    slug
    descripcion
    activo
  }
}
```

### 4.2 Nuevo archivo `graphql/mutations/unidades.ts`

```graphql
mutation CreateUnidad($nombre: String!, $descripcion: String) {
  createUnidad(nombre: $nombre, descripcion: $descripcion) {
    unidad { id nombre slug }
    success message
  }
}

mutation UpdateUnidad($id: Int!, $nombre: String, $descripcion: String, $activo: Boolean) {
  updateUnidad(id: $id, nombre: $nombre, descripcion: $descripcion, activo: $activo) {
    unidad { id nombre slug }
    success message
  }
}

mutation DeleteUnidad($id: Int!) {
  deleteUnidad(id: $id) {
    success message
  }
}
```

### 4.3 Modificar queries existentes

| Query/Mutation | Cambio |
|---|---|
| `GET_PERSONAS` | Agregar `$unidadId: Int!`, filtrar por `unidadId` |
| `GET_TIPOS_DOCUMENTO` | Agregar `$unidadId: Int!`, filtrar por `unidadId` |
| `GET_DOCUMENTOS_PENDIENTES` | Agregar `$unidadId: Int!`, filtrar por `unidadId` |
| `CREATE_PERSONA` | Agregar `$unidadId: Int!` |
| `CREATE_TIPO_DOCUMENTO` | Agregar `$unidadId: Int!` |
| `UPDATE_TIPO_DOCUMENTO` | Sin cambio |
| `GET_PERSONA` | Sin cambio (ya filtra por ID) |
| `GET_DOCUMENTOS_PERSONA` | Sin cambio (ya filtra por persona) |

---

## FASE 5: Frontend — UI ⛔ OBSOLETA (eliminada en FASE 17)

### 5.1 Selector de unidad en `Layout.tsx`
**Archivo:** `frontend/src/components/layout/Layout.tsx`

- Agregar dropdown en el **header** (barra superior, derecha)
- Usa `useUnidad()` del contexto
- Muestra unidades activas como opciones
- Al cambiar, se actualiza el contexto → todas las queries se re-ejecutan automáticamente
- Diseño: `Select` de shadcn/ui junto al texto "Sistema de Digitalización"

### 5.2 Nueva página de Unidades
**Archivo:** `frontend/src/pages/configuracion/Unidades.tsx` (nueva)

- **Tabla** con columnas: Nombre, Descripción, Activo, Acciones (editar/eliminar)
- **Dialog** para crear/editar: campo nombre, textarea descripción, checkbox activo
- **Botón eliminar** con confirmación (dialog de alerta)
- Usa `GET_UNIDADES`, `CREATE_UNIDAD`, `UPDATE_UNIDAD`, `DELETE_UNIDAD`
- Diseño consistente con `TiposDocumento.tsx`

### 5.3 Modificar `App.tsx`
**Archivo:** `frontend/src/App.tsx`

- Importar `Unidades` y agregar ruta: `/configuracion/unidades`

### 5.4 Modificar sidebar en `Layout.tsx`
**Archivo:** `frontend/src/components/layout/Layout.tsx`

- Agregar item de navegación: `{ name: 'Unidades', href: '/configuracion/unidades', icon: Building2 }`
- Ubicarlo antes de "Tipos de Documento"

### 5.5 Modificar todas las páginas existentes

| Página | Cambio |
|---|---|
| **Dashboard** | Agregar `unidadId` a query de personas, mostrar stats de la unidad activa |
| **ListaPersonas** | Pasar `unidadId` del contexto a `GET_PERSONAS` |
| **RegistrarPersona** | Asociar automáticamente a `unidadActiva` al crear |
| **CasilleroDocumentos** | Sin cambio (ya filtra por persona) |
| **SubirDocumentos** | Enviar `unidad_id` al endpoint REST `/api/upload/batch/` |
| **DocumentosPendientes** | Pasar `unidadId` del contexto a `GET_DOCUMENTOS_PENDIENTES` |
| **TiposDocumento** | Pasar `unidadId` del contexto a `GET_TIPOS_DOCUMENTO`, asociar al crear |

---

## FASE 6: Ajustes Finales ⛔ OBSOLETA (eliminada en FASE 17)

### 6.1 Seeders
- **Eliminar** `backend/apps/documentos/seeders.py` (ya no se usan, los tipos se crean desde UI)
- **Eliminar** `backend/apps/personas/management/commands/seed_personas.py` (o adaptarlo para que pida unidad)
- Remover cualquier referencia a seeders en migraciones si es posible

### 6.2 REST Endpoints
**Archivo:** `backend/apps/documentos/views.py`

- `UploadPDFView`: validar `unidad_id`, solo clasificar contra tipos de esa unidad
- `UploadBatchPDFView`: validar `unidad_id`, solo clasificar contra tipos de esa unidad
- Retornar `unidad_nombre` en la respuesta para referencia

### 6.3 Validaciones
- Unidad inactiva no aparece en selects del frontend
- No se puede eliminar una unidad con personas asociadas (el backend retorna error)
- Código de persona único **por unidad** (no global)
- Al cambiar de unidad, el Dashboard se resetea

### 6.4 Limpieza de código
- Remover `unique=True` global de `codigo` en Persona (ahora es por unidad)
- Remover `unique=True` global de `slug` en TipoDocumento (ahora es por unidad)
- Verificar que todas las migraciones se generan correctamente

---

## Orden de Ejecución

| Paso | Fase | Archivos afectados |
|---|---|---|
| 1 | Fase 1: Modelos + migraciones | Backend models, settings, migrations |
| 2 | Fase 2: GraphQL backend | schema.py de cada app, views.py, pdf_processor.py |
| 3 | Fase 3: Contexto frontend | types/index.ts, contexts/, App.tsx |
| 4 | Fase 4: Queries frontend | graphql/queries/*.ts, graphql/mutations/*.ts |
| 5 | Fase 5: UI | Layout.tsx, todas las páginas, nueva página Unidades |
| 6 | Fase 6: Ajustes | seeders, views, validaciones |

---

## FASE 7: Simplificación del Formulario de Tipo de Documento ✅ COMPLETADA

### Problema
El formulario actual tiene 7 campos visibles de golpe con terminología técnica
(palabra:peso, requiere, excluye, score_minimo). Es confuso para el usuario promedio.

### 7.1 Formulario en 2 niveles
**Archivo:** `frontend/src/pages/configuracion/TiposDocumento.tsx`

**Campos principales (siempre visibles):**
- Nombre * (se mantiene)
- Palabras Clave * — simplificado a solo palabras separadas por Enter (sin formato `peso`)
- Obligatorio — checkbox simple

**Opciones avanzadas (colapsable, por defecto cerrado):**
- Requiere (keywords obligatorias)
- Excluye (slugs)
- Score Mínimo (default: 3)
- Orden (default: auto-incremental)

### 7.2 Auto-asignar peso
Cuando el usuario escribe `"certificado, nacimiento"` sin formato `:peso`,
el `handleCreate` generará automáticamente `"certificado:3, nacimiento:3"`
antes de enviarlo al backend. Si el usuario escribe `"certificado:5"`
manualmente, se respeta.

### 7.3 Actualizar labels y placeholders
- Label: "Palabras Clave" (quitar "(palabra:peso)")
- Placeholder: "Escribir palabra y presionar Enter"
- Quitar helper text técnico del peso

### 7.4 Unificar create/edit en un solo form
Mergear los dialogs de crear y editar en un solo estado compartido,
reduciendo ~100 líneas de código duplicado.

### Archivos afectados
| Archivo | Cambio |
|---|---|
| `TiposDocumento.tsx` | Simplificar form, agregar collapsible, auto-peso, unificar create/edit |

---

## FASE 8: Eliminar Campos Avanzados del Tipo de Documento ✅ COMPLETADA

### Problema
Los campos `requiere`, `excluye`, `score_minimo`, `es_obligatorio` y `orden` agregan complejidad innecesaria tanto en la UI como en la lógica de clasificación. El usuario solo necesita definir Nombre y Palabras Clave.

### Cambios realizados

**Backend:**
| Archivo | Cambio |
|---|---|
| `documentos/models.py` | Eliminar 5 campos, propiedades `lista_requiere`/`lista_excluye`, cambiar ordering |
| `documentos/mutations.py` | Simplificar `clasificar_documento()` (solo score), eliminar args de Create/Update |
| `documentos/schema.py` | Quitar 5 campos de `TipoDocumentoType` |
| `documentos/admin.py` | Quitar `es_obligatorio` y `orden` de list_display/list_filter |
| `storage/pdf_processor.py` | Simplificar `_classify_local()` (solo score, sin filtros previos) |
| `documentos/migrations/0005_remove_campos_avanzados.py` | Nueva migración para eliminar los 5 campos |
| `documentos/migrations/0004_seed_tipos_documento.py` | Limpiar campos eliminados del seed |

**Frontend:**
| Archivo | Cambio |
|---|---|
| `types/index.ts` | Quitar 5 campos de interface `TipoDocumento` |
| `graphql/queries/documentos.ts` | Quitar campos de `GET_TIPOS_DOCUMENTO` y `GET_DOCUMENTOS_PERSONA` |
| `graphql/mutations/documentos.ts` | Quitar variables/args de `CREATE` y `UPDATE` |
| `pages/configuracion/TiposDocumento.tsx` | Form solo Nombre + Palabras Clave, tabla simplificada |
| `pages/personas/CasilleroDocumentos.tsx` | Quitar badge "Req." |

### Clasificación resultante
El sistema ahora clasifica únicamente por score de palabras clave: busca el tipo con mayor puntaje. Sin filtros previos de requiere/excluye/score_minimo.

---

## FASE 9: Visor de Documentos con Cards Difuminadas ✅ COMPLETADA

> Completada el 2026-10-09 — implementada con rutas reales en
> `modules/personas/pages/` (no en `src/pages/` como decía el plan) y rutas en
> `config/routes.tsx`. Verificación 2026-10-09: existe todo (lista, visor,
> rutas, nav, campo `tieneDocumentosClasificados`).

### Descripción
Nuevo módulo con dos rutas: una lista de personas con filtro de búsqueda e indicador de documentos clasificados, y una vista de documentos por persona con cards de previsualización difuminada que se expanden inline.

---

### 9.1 Backend — Nuevo campo en query `personas`
**Archivo:** `backend/apps/personas/schema.py`

Agregar campo `tiene_documentos_clasificados: Boolean` al `PersonaType`:
```python
# Implementado con Strawberry en vez de graphene:
@strawberry_django.field
def tiene_documentos_clasificados(self) -> bool:
    return self.documentos.exclude(tipo_documento__isnull=True).exists()
```

**Archivo:** `frontend/src/graphql/queries/personas.ts`
Agregar `tieneDocumentosClasificados` al query `GET_PERSONAS`.

**Archivo:** `frontend/src/types/index.ts`
Agregar campo opcional `tieneDocumentosClasificados?: boolean` a `Persona`.

---

### 9.2 Ruta `/vista-persona` — Lista de personas
**Archivo:** `frontend/src/pages/personas/VistaPersonaLista.tsx` (nuevo)

- Input de búsqueda (por nombre, código, CI)
- Paginación (10 por página)
- Tabla con columnas: Código, Nombres, Apellidos, CI, **Tiene docs. clasificados** (Sí/No badge)
- Al hacer clic en una fila → navega a `/vista-persona/:id`
- Usa `GET_PERSONAS` (con el nuevo campo `tieneDocumentosClasificados`)

---

### 9.3 Ruta `/vista-persona/:id` — Visor de documentos
**Archivo:** `frontend/src/pages/personas/VistaPersonaDocumentos.tsx` (nuevo)

- Botón "Volver" (esquina superior izquierda) → `/vista-persona`
- Encabezado con datos de la persona (nombre, código, CI)
- Grid responsivo de cards (3 cols lg, 2 md, 1 sm)
- **Solo documentos clasificados** (con `tipoDocumento` asignado)
- **Card (cerrada):**
  - Thumbnail con `filter: blur(8px) brightness(0.7)`
  - Badge con nombre del tipo de documento
  - Número de página
  - Cursor pointer
- **Card (expandida):** al hacer clic
  - Ocupa todo el ancho (`grid-column: 1 / -1`)
  - Muestra PDF en `<iframe>` sin difuminar
  - Botón **Imprimir** (abre PDF en nueva ventana + `print()`)
  - Botón **Cerrar** (vuelve a estado compacto)
  - Animación CSS (`transition-all`, `max-height`/`scale`)
- **Estados:** loading, empty ("No tiene documentos clasificados"), error

Usa `GET_PERSONA` + `GET_DOCUMENTOS_PERSONA`.

---

### 9.4 Nuevas rutas en `App.tsx`
**Archivo:** `frontend/src/App.tsx`

- Importar `VistaPersonaLista` y `VistaPersonaDocumentos`
- Agregar:
  ```tsx
  <Route path="/vista-persona" element={<VistaPersonaLista />} />
  <Route path="/vista-persona/:id" element={<VistaPersonaDocumentos />} />
  ```

---

### 9.5 Sidebar
**Archivo:** `frontend/src/components/layout/Layout.tsx`

Agregar item al array `navigation`:
```tsx
{ name: 'Visor Documentos', href: '/vista-persona', icon: Eye }
```
Importar `Eye` desde `lucide-react` si no está ya importado.

---

### Archivos afectados

| Archivo | Cambio |
|---|---|
| `backend/apps/personas/schema.py` | Agregar `tiene_documentos_clasificados` a `PersonaType` |
| `frontend/src/types/index.ts` | Agregar campo a `Persona` |
| `frontend/src/graphql/queries/personas.ts` | Agregar campo a `GET_PERSONAS` |
| `frontend/src/pages/personas/VistaPersonaLista.tsx` | **Nuevo** — lista con búsqueda e indicador |
| `frontend/src/pages/personas/VistaPersonaDocumentos.tsx` | **Nuevo** — cards difuminadas, expansión inline |
| `frontend/src/App.tsx` | Agregar rutas |
| `frontend/src/components/layout/Layout.tsx` | Agregar nav item |

### Orden de ejecución

1. Backend: agregar campo `tiene_documentos_clasificados` a `PersonaType`
2. Frontend: agregar campo a types y query de personas
3. Crear `VistaPersonaLista.tsx`
4. Crear `VistaPersonaDocumentos.tsx`
5. Agregar rutas en `App.tsx`
6. Agregar nav item en `Layout.tsx`

---

## FASE 10: Docker Compose — Infraestructura

### Problema
El `docker compose up --build` no funciona. No aparecen contenedores en Docker Desktop.

### Causa raíz
Docker Desktop tiene un proxy interno configurado (`HTTP Proxy: http.docker.internal:3128`) que intercepta las conexiones HTTP de los contenedores pero no las reenvía correctamente. Esto impide que `apt-get update` descargue paquetes desde los repositorios de Debian/Ubuntu dentro de las imágenes.

**Diagnóstico confirmado:**
- DNS resuelve correctamente (ping a `deb.debian.org` funciona)
- Puertos 80 y 443 funcionan desde la máquina host
- No funcionan desde dentro de contenedores Docker (ni bridge ni host network)
- Afecta a todas las imágenes Debian/Ubuntu, no solo a una específica

### Cambios ya realizados

| Archivo | Cambio |
|---|---|
| `subida-arquitectura/.env` | `POSTGRES_HOST=localhost` → `POSTGRES_HOST=host.docker.internal` |
| `subida-arquitectura/docker/frontend/Dockerfile` | Agregar `--host 0.0.0.0` al CMD de Vite |
| `subida-arquitectura/docker-compose.override.yml` | Eliminar redefinición de `build` innecesaria |

### Pendiente: Solucionar el proxy de Docker Desktop

**Opción A (recomendada): Desactivar proxy en Docker Desktop**
1. Abrir Docker Desktop → Settings → Resources → Proxies
2. Desactivar "Manual proxy configuration" (o poner en blanco)
3. Apply & Restart
4. Volver a correr `docker compose up --build`

**Opción B: Configurar proxy en el Dockerfile del backend**
Si no se puede desactivar el proxy, modificar `subida-arquitectura/docker/backend/Dockerfile`:
```dockerfile
RUN echo 'Acquire::http::Proxy "http.docker.internal:3128";' > /etc/apt/apt.conf.d/proxy.conf && \
    apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*
```

### Verificación
Una vez solucionado el proxy, correr:
```bash
cd subida-arquitectura
docker compose up --build
```
Esperar ver en Docker Desktop:
- `subida-arquitectura-minio-1` (puerto 9001 para consola)
- `subida-arquitectura-backend-1` (puerto 8000)
- `subida-arquitectura-frontend-1` (puerto 5173)

---

## FASE 11: Docker Compose — Fix apt-get ✅ COMPLETADA

### Problema
El `docker compose up --build` fallaba porque `apt-get update` no podía conectarse a los repositorios de Debian dentro del contenedor.

### Causa raíz
La dependencia `psycopg2-binary` ya trae binarios pre-compilados. No se necesitaba `gcc` ni `libpq-dev`.

### Cambio realizado

| Archivo | Cambio |
|---|---|
| `subida-arquitectura/docker/backend/Dockerfile` | Eliminar capa `RUN apt-get update && apt-get install -y gcc libpq-dev` |

---

## FASE 12: Frontend — Corrección de Rutas ✅ COMPLETADA

### Problema
Múltiples navegaciones en el frontend usaban rutas que no existían, causando redirecciones al Dashboard.

### Errores encontrados y corregidos

| # | Archivo | Línea | Ruta incorrecta | Ruta correcta |
|---|---|---|---|---|
| 1 | `Dashboard.tsx` | 82 | `/personas/nueva` | `/personas/registrar` |
| 2 | `Dashboard.tsx` | 113 | `/personas/${id}` | `/personas/${id}/casillero` |
| 3 | `ListaPersonas.tsx` | 33 | `/personas/nueva` | `/personas/registrar` |
| 4 | `ListaPersonas.tsx` | 99 | `/personas/${id}` | `/personas/${id}/casillero` |
| 5 | `SubirDocumentos.tsx` | 281 | `/personas/${id}` | `/personas/${id}/casillero` |
| 6 | `DocumentosPendientes.tsx` | 121 | `/personas/${id}` | `/personas/${id}/casillero` |
| 7 | `routes.tsx` | 20 | `/personas/lista` | `/vista-persona` |
| 8 | `routes.tsx` | 21 | `/personas/:id/documentos` | `/vista-persona/:id` |

### Otros fixes

| Archivo | Cambio |
|---|---|
| `UnidadContext.tsx:3` | Import roto: `../../graphql/queries/unidades` → `@/graphql/queries/unidades` |
| `App.tsx` | Eliminar `BrowserRouter` y `UnidadProvider` duplicados (ya están en `main.tsx`) |
| `App.tsx` | Restaurar `Layout` wrapper para páginas (excepto `/login`) |

---

## FASE 13: Gemini SDK — Migración a google-genai 🗑 ELIMINADA (decisión sin-IA 2026-10-09)

### Problema
El SDK `google-generativeai` está descontinuado (soporte terminó Nov 2025). El modelo `gemini-2.0-flash` ya no está disponible.

### Cambios realizados

| Archivo | Cambio |
|---|---|
| `requirements/base.txt` | `google-generativeai==0.8.4` → `google-genai>=1.0.0` |
| `apps/storage/ai_classifier.py` | Reescribir `_configure()` usando `genai.Client()` |
| `apps/storage/ai_classifier.py` | `self.model.generate_content()` → `self.client.models.generate_content()` |
| `apps/storage/ai_classifier.py` | Modelo: `gemini-2.0-flash` → `gemini-3.6-flash` |

---

## FASE 14: IA — Creación Automática de Tipos de Documento 🗑 ELIMINADA (decisión sin-IA 2026-10-09)

> Eliminada el 2026-10-09 — borrado `ai_classifier.py`, rama IA de
> `pdf_processor.py`, mutation `sugerirClasificacionIa`; `crearYAsignarTipoIa`
> renombrada a `crearYAsignarTipo` (manual, sin IA); frontend con dialog manual
> de crear-tipo. Suite 161 tests en verde + `npm run build` OK.

### Descripción
Cuando la IA sugiere que un documento es de un tipo nuevo, el usuario puede crear el tipo directamente desde el dialog de sugerencia, sin ir a Configuración.

### Flujo nuevo

| Paso | Qué ocurre |
|------|-----------|
| 1 | User clickea "Sugerir IA" en un documento |
| 2 | Gemini devuelve: `es_nuevo_tipo=true`, nombre sugerido, keywords sugeridas |
| 3 | Dialog muestra campo editable con el nombre sugerido |
| 4 | User clickea **"Crear tipo y asignar"** |
| 5 | Se crea el `TipoDocumento` automáticamente |
| 6 | Se asigna el documento al nuevo tipo |
| 7 | Se hace `reclasificar_todos()` para documentos similares |

### Cambios realizados

**Backend:**

| Archivo | Cambio |
|---|---|
| `apps/storage/ai_classifier.py` | Prompt actualizado para pedir `NOMBRE_NUEVO` cuando es tipo nuevo |
| `apps/storage/ai_classifier.py` | `suggest_classification()` retorna `nombre_sugerido` |
| `apps/documentos/mutations.py` | `SugerirClasificacionIA` retorna `nombre_sugerido` |
| `apps/documentos/mutations.py` | Nueva mutation `CrearYAsignarTipoIA` |
| `apps/documentos/mutations.py` | `CrearYAsignarTipoIA`注册在 Mutation ObjectType |

**Frontend:**

| Archivo | Cambio |
|---|---|
| `graphql/mutations/documentos.ts` | `SUGERIR_CLASIFICACION_IA` incluye `nombreSugerido` |
| `graphql/mutations/documentos.ts` | Nueva mutation `CREAR_Y_ASIGNAR_TIPO_IA` |
| `CasilleroDocumentos.tsx` | Import `CREAR_Y_ASIGNAR_TIPO_IA` |
| `CasilleroDocumentos.tsx` | State `nombreNuevoTipo` y `loadingCrearTipo` |
| `CasilleroDocumentos.tsx` | Función `handleCrearYAsignar()` |
| `CasilleroDocumentos.tsx` | Dialog: campo editable nombre + botón "Crear tipo y asignar" |

---

## FASE 15: Bugs Críticos y de Lógica del Frontend ⏸ PARCIAL (A,B hechos; C obsoleta; D-G pendientes)

> Estado real 2026-10-09: 15.A (login sin `onLogin`) y 15.B (AuthContext +
> ProtectedRoute) ya están corregidos en código. 15.C quedó obsoleta (no hay
> unidad — ver FASE 17). Pendientes: 15.D (múltiples docs por tipo), 15.E
> (orderBy Dashboard), 15.F (bloquear nombres inválidos), 15.G (triviales).

### 15.A Fix crítico del login

**Problema:** `Login.tsx` recibe `onLogin` por props y lo llama en línea 32, pero `routes.tsx:15`
lo renderiza como `<Login />` sin pasar la prop. Al autenticarse bien: se guarda el token en
localStorage, `onLogin()` lanza `TypeError`, y el `catch` en línea 36 muestra "Error de conexión".

| Archivo | Cambio |
|---|---|
| `Login.tsx` | Quitar prop `onLogin` e `interface LoginProps`; usar `useNavigate()` → `navigate('/')` tras login exitoso |

### 15.B AuthContext + guardas de ruta

**Problema:** `shared/guards/` está vacía; cualquier ruta es accesible sin token (solo se oculta el
`Layout` en `/login`). La guarda es de UX: el backend sigue sin validar el Bearer token (deuda
conocida, no se toca en este alcance).

| Archivo | Cambio |
|---|---|
| `shared/contexts/AuthContext.tsx` | **Nuevo** — expone `user`, `token`, `login()`, `logout()`; persiste en localStorage |
| `shared/guards/ProtectedRoute.tsx` | **Nuevo** — sin token redirige a `/login`; en `/login` con token redirige a `/` |
| `main.tsx` | Envolver con `<AuthProvider>` |
| `App.tsx` | Usar `useAuth()`; envolver rutas con `ProtectedRoute`; eliminar lógica manual de logout |
| `Layout.tsx` | Usar `useAuth().logout()` en vez de la prop `onLogout` |

### 15.C Casillero — unidad de la persona ⛔ OBSOLETA (sin unidad desde FASE 17)

**Problema:** `CasilleroDocumentos.tsx:35-38` carga `GET_TIPOS_DOCUMENTO` con `unidadActiva`, pero la
persona puede pertenecer a otra unidad. Al cambiar de unidad, el casillero muestra tipos equivocados.

| Archivo | Cambio |
|---|---|
| `backend/apps/personas/schema.py` | Agregar `'unidad'` a los campos de `PersonaType` |
| `shared/graphql/queries/personas.ts` | `GET_PERSONA`: agregar `unidad { id }` |
| `CasilleroDocumentos.tsx` | Usar `persona.unidad.id` para `GET_TIPOS_DOCUMENTO` (skip hasta que persona cargue) |

### 15.D Casillero — múltiples documentos por tipo

**Problema:** `CasilleroDocumentos.tsx:57-59` (`getDocumentoForTipo`) devuelve solo el PRIMER
documento de cada tipo. El requerimiento pide soportar varias páginas del mismo tipo (ej. libreta
escolar de 6º/5º/4º); las páginas extra quedan ocultas.

| Archivo | Cambio |
|---|---|
| `CasilleroDocumentos.tsx` | Reemplazar `getDocumentoForTipo` por agrupación `tipo → Documento[]`; renderizar TODAS las páginas por tipo (thumbnail principal + contador "+N" o mini-cards apiladas); mantener visor/IA/asignar por cada documento |

### 15.E Dashboard — "Últimas Personas Registradas" no es real

**Problema:** `Dashboard.tsx:110-124` muestra página 1 (limit 10) ordenada por `codigo`
(`personas/models.py` ordering), no por fecha de creación.

| Archivo | Cambio |
|---|---|
| `backend/apps/personas/schema.py` | Agregar argumento `orderBy` a `resolve_personas` (whitelist segura: `codigo`, `-codigo`, `created_at`, `-created_at`, `nombres`, `-nombres`) |
| `shared/graphql/queries/personas.ts` | `GET_PERSONAS`: variable opcional `$orderBy: String` |
| `Dashboard.tsx` | Pasar `orderBy: '-created_at'` en el card de últimas personas |

> Las 3 tarjetas `--` del Dashboard quedan fuera de alcance (requieren resolver `stats(unidadId)`
> nuevo → feature).

### 15.F SubirDocumentos — bloquear nombres inválidos

**Problema:** `SubirDocumentos.tsx:209-239` marca "Nombre inválido" pero el botón de subida (línea
310) no se deshabilita ni filtra; el backend rechaza los inválidos con error.

| Archivo | Cambio |
|---|---|
| `SubirDocumentos.tsx` | Deshabilitar botón si hay nombres inválidos y mostrar aviso; filtrar inválidos antes de enviar |

### 15.G Triviales

| Archivo | Cambio |
|---|---|
| `DocumentosPendientes.tsx` | Try/catch + loading por fila en `handleAsignar` (`:34-42`) |
| `Unidades.tsx` | Corregir confirmación de borrado: "Se eliminará permanentemente" (no "Se desactivará") |

### Verificación

- Frontend: `npm run build` (tsc + vite) y `npm run lint`.
- Backend: `python manage.py check` (sin cambios de modelo → sin migraciones).

---

## FASE 16: Migración Graphene → Strawberry GraphQL

**Estado:** completada. Sin cambios en modelos, migraciones, endpoints REST ni frontend.

### Motivación
Graphene-Django quedó sin mantenimiento y no es compatible con las versiones actuales de
Python. Strawberry es actively maintained y tipado.

### Cambios

| Archivo | Cambio |
|---|---|
| `requirements/base.txt` | `graphene-django==3.1.5` → `strawberry-graphql==0.284.1` + `strawberry-graphql-django==0.67.0` |
| `config/settings/base.py` | `graphene_django` → `strawberry_django` en `INSTALLED_APPS`; se elimina `GRAPHENE`; se agrega `STRAWBERRY_DJANGO` |
| `config/urls.py` | `graphene_django.views.GraphQLView` → `strawberry.django.views.GraphQLView` con `schema=schema` explícito |
| `config/schema.py` | `graphene.Schema` → `strawberry.Schema` con herencia múltiple de los 4 `Query`/`Mutation` |
| `apps/{unidades,personas,documentos,users}/schema.py` | `ObjectType`/`DjangoObjectType` → `@strawberry_django.type`; `resolve_*` → `@strawberry.field` |
| `apps/{personas,documentos}/mutations.py` | Clases `Mutation` y payloads a `@strawberry.type` / `@strawberry.mutation` |
| `apps/graphql/management/commands/dump_graphql_schema.py` | Nuevo comando para exportar el SDL |
| `docs/schema.graphql` | SDL generado con el schema nuevo |
| `docs/schema.graphql.baseline` | SDL original de Graphene, como línea base de comparación |
| `apps/tests/` | Nuevo: `test_contrato.py`, `test_queries.py`, `test_mutations.py` |

### Trampas de la migración

1. **FKs sin redeclarar.** `strawberry_django.type(Model)` infiere las relaciones, pero sin
   anotación explícita una FK queda apuntando al tipo genérico `DjangoModelType { pk }`. Eso
   rompe las selections anidadas (`persona { codigo }`) en tiempo de ejecución, no de compilación.
   Cada FK usada por el frontend se redeclara con `@strawberry_django.field`.
2. **Enums de `choices`.** `Documento.estado` y `User.role` exponían enums generados
   (`DocumentosDocumentoEstadoChoices`). Strawberry no los replica; ahora son `String!` con el
   valor de la base en minúsculas (`pendiente`, `clasificado`, `admin`). Es compatible con lo que
   ya hacía el frontend.
3. **Nombres de operación.** Strawberry convierte `crear_y_asignar_tipo_ia` → `crearYAsignarTipoIa`
   con la misma convención de graphene, por eso el contrato no se movió.
4. **Nulls en variables.** El frontend declara `$page: Int` / `$limit: Int` como opcionales pero
   siempre envía números. Se mantienen nullable con default (`Int = 1`) para que un `null`
   explícito caiga al default en lugar de romper la consulta.
5. **`allow_queries_via_get`.** No existe el equivalente en `GraphQLView`; se configuró
   `allow_queries_via_get=False` para reproducir el comportamiento previo.

### Verificación

- `python manage.py check` y `makemigrations --check`: sin cambios en modelos.
- Las 25 operaciones y sus argumentos coinciden exactamente con el SDL de Graphene; las únicas
  diferencias son las deliberadas (enums → `String`, no-null, orden).
- `python manage.py test apps.tests`: 63 tests en verde.


















# ETAPA-REFINAMIENTO-V1 — Plan de Refinamiento del Proyecto Subida

**Objetivo general:** Endurecer la base multi-tenant, robustecer el clasificador de documentos (normalización + fuzzy + scoring) y habilitar colas de revisión humana, sin rediseñar la arquitectura existente.

**Instrucciones para la IA generadora de código:**
- Cada fase es **independiente y ejecutable por separado**. No dependas de fases posteriores para completar una.
- Al terminar una fase, cambia su estado de `INCOMPLETO` a `COMPLETADO` en este mismo documento.
- No modifiques el alcance de otras fases. Si detectas que una fase requiere cambios de otra, documéntalo como nota y sigue.
- Ignora por completo la carpeta `core/` raíz. No la toques, no la integres, no la elimines.
- Respeta el stack actual: Django 4.2.16, Strawberry GraphQL, PostgreSQL, MinIO, React 18 + Vite + TypeScript, Apollo Client.
- No introduzcas dependencias nuevas sin justificarlo (excepto `rapidfuzz` y `Pillow`/`imagehash` cuando se indique).

---

## FASE 1 — Corrección de aislamiento multi-tenant en ingesta

**Estado:** `OBSOLETA` (single-tenant desde FASE 17: `codigo`/`slug` únicos globales, sin filtro por unidad)

**Prioridad:** 🔴 Crítica

**Objetivo:** Eliminar el riesgo de que documentos se asignen a personas de otra unidad cuando comparten `codigo`.

### Alcance

1. En `apps/storage/ingesta.py` (o donde se resuelva la persona), reemplazar toda búsqueda tipo:

    Persona.objects.filter(codigo=codigo).first()

   por una versión que **siempre** filtre por unidad:

    Persona.objects.filter(codigo=codigo, unidad=unidad).first()

2. Revisar **todos** los puntos del pipeline donde se resuelva `Persona`, `TipoDocumento` o `Documento` y verificar que filtren por `unidad`.
3. Revisar el `ai_classifier` y el `pdf_processor`: si reciben objetos, no deben buscar personas por código sin unidad.
4. Agregar un test (aunque sea mínimo) que demuestre que dos unidades con la misma `codigo` no colisionan.

### Criterios de aceptación

- [x] Ninguna query a `Persona`, `TipoDocumento` u `Documento` en el pipeline de ingesta ocurre sin `unidad=...`.
- [x] Existe al menos un test que crea dos unidades con personas del mismo `codigo` y verifica que el documento se asigna a la correcta.

### Notas

- No refactorices el pipeline completo. Solo agrega el filtro donde falte.
- Si `unidad` no está disponible en alguna función, propágala como parámetro en lugar de inferirla.

### Registro

Completado el 2026-10-05 — ingesta acotada por unidad, `asignar_documento` valida tenant, `test_aislamiento.py` (11 tests).

**Desviaciones y hallazgos:**
- Se corrigió un bug preexistente: la migración `0001_initial` creó `TipoDocumento.slug` con `UNIQUE` global, contradiciendo la intención de "slug por unidad". La migración `0008_tipodocumento_slug_por_unidad` elimina ese constraint. Sin esto, dos unidades no podían tener el mismo tipo.

---

## FASE 2 — Bug del few-shot en `GeminiClassifier`

**Estado:** `ELIMINADA` (decisión sin-IA 2026-10-09: `ai_classifier.py` y `test_ai_classifier.py` borrados)

**Prioridad:** 🔴 Crítica

**Objetivo:** Corregir el contrato roto entre el prompt few-shot y el parser de respuesta.

### Alcance

1. En `apps/storage/ai_classifier.py`, localizar el prompt de sugerencia (`Sugerir`).
2. Verificar que los **dos ejemplos few-shot** emitan exactamente las mismas claves que el parser espera: `TIPO:`, `NOMBRE_NUEVO:`, `KEYWORDS:`.
3. Corregir el ejemplo 2 que emite `NEMON_NUEVO:` → debe ser `NOMBRE_NUEVO:`.
4. Endurecer el parser para que:
   - Sea case-insensitive en las claves.
   - Acepte `NEMON_NUEVO` como alias de `NOMBRE_NUEVO` (defensa en profundidad).
   - Ignore líneas vacías o comentarios.
5. Agregar un test unitario que alimente al parser con el output esperado de ambos ejemplos y valide que devuelve la estructura correcta.

### Criterios de aceptación

- [x] El prompt y el parser usan exactamente las mismas claves.
- [x] Existe un test que valida el parseo de un output de ejemplo real.
- [x] Si el parser recibe `NEMON_NUEVO`, no falla (lo mapea a `NOMBRE_NUEVO`).

### Notas

- No cambies el modelo de Gemini ni el resto del prompt.
- No toques el clasificador local en esta fase (eso es Fase 3).

### Registro

Completado el 2026-10-05 — ejemplo 2 corregido a `NOMBRE_NUEVO:` y parser extraído a `_parsear_sugerencia()` con alias, case-insensitive y tolerancia a ruido; `test_ai_classifier.py` (10 tests).

---

## FASE 3 — Clasificador local robusto (normalización + fuzzy + score)

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Reemplazar el match estricto de keywords por un pipeline tolerante a OCR sucio, con scoring y umbral.

### Alcance

1. Crear un módulo nuevo: `apps/storage/clasificador.py` con:
   - `normalizar(texto: str) -> str`: minúsculas, quitar acentos (NFKD), colapsar espacios, eliminar caracteres no alfanuméricos.
   - `coincide(keyword: str, texto_norm: str, umbral: int = 85) -> bool`: usa `rapidfuzz.fuzz.partial_ratio` por palabra.
   - `clasificar(texto: str, tipos: Iterable[TipoDocumento]) -> ResultadoClasificacion`: devuelve un dataclass con `tipo_ganador`, `score_ganador`, `score_segundo`, `keywords_matcheadas: list[str]`, `es_dudosa: bool`.
2. Agregar `rapidfuzz` a `requirements/base.txt`.
3. Reglas de scoring:
   - Cada keyword aporta `peso * (1 + coincidencia_exacta)` (exacta vale doble que fuzzy).
   - Keyword `obligatoria=True` (si el campo existe; si no, se agrega en Fase 4) actúa como gate: si no matchea, el tipo queda descartado.
   - `es_dudosa = (score_ganador - score_segundo) < margen` (margen configurable, default 0.15 relativo).
4. Refactorizar `_classify_local` en `ingesta.py` para que use `clasificar()` y devuelva la estructura completa, no solo el tipo.
5. Cambiar la decisión de llamar a Gemini: **solo** si `score_ganador < umbral_minimo` **Y** `len(texto_util) > 200`. Si no, va a `sin_clasificar`.
6. Test unitario con casos: texto limpio, texto con OCR sucio (`F4ctur4`, `T0tal 4 pagar`), texto ambiguo entre dos tipos, texto vacío.

### Criterios de aceptación

- [x] `clasificador.py` existe y está aislado (no importa modelos de Django directamente, recibe objetos).
- [x] `_classify_local` fue reemplazado por `clasificar()`.
- [x] Los tests cubren los 4 casos descritos y pasan.
- [x] El comportamiento de "cuándo llamar a Gemini" cambió según la regla del punto 5.

### Notas

- No modifiques el modelo `TipoDocumento` en esta fase (eso es Fase 4).
- El formato actual `palabra:peso` en `palabras_clave` se sigue respetando.
- `rapidfuzz` es la única dependencia nueva permitida aquí.

### Registro

Completado el 2026-10-05 — `clasificador.py` con normalización NFKD, frases y fuzzy; `rapidfuzz==3.14.6` agregado; `test_clasificador.py` (41 tests).

**Desviación — umbral 75 en vez de 85 (justificada):**
El `umbral=85` especificado no reconoce el caso de OCR del propio plan. Para `F4ctur4` contra la keyword `factura`, `partial_ratio` da 76.9. Con 85, ese documento se descartaría y nunca se clasificaría. Se fijó `UMBRAL_FUZZY = 75`, el mínimo que sí reconoce el caso, y se compensó el riesgo de falsos positivos con:
- coincidencia por token exacto (protege keywords cortas: `total` contra `piso documental estatal`);
- phrases: una keyword de varias palabras exige que la frase completa aparezca;
- guardia de longitud: si la diferencia de largo es de 1 carácter o menos y no hay match exacto, se descarta (los errores de OCR no alargan la palabra).

**Notas adicionales:**
- El gate de Gemini quedó en `score_ganador < 4.0` **y** `len(texto_util) > 200`, medido sobre texto ya normalizado.
- `score_segundo` se toma del segundo tipo **competidor**: los tipos descartados por una obligatoria no compiten.

---

## FASE 4 — Modelo de datos: score, dudosa y keywords obligatorias

**Estado:** `COMPLETADO`

**Prioridad:** 🟠 Alta

**Objetivo:** Persistir el resultado del clasificador y permitir keywords obligatorias.

### Alcance

1. Migración en `apps/documentos`:
   - `Documento.score = FloatField(null=True, blank=True)`
   - `Documento.keywords_matcheadas = JSONField(default=list, blank=True)`
   - `Documento.estado`: agregar `'dudosa'` a las opciones (`clasificado`, `dudosa`, `pendiente`, `sin_clasificar`, `verificado`). Mantener compatibilidad con datos existentes.
2. Migración en `apps/documentos` (o donde viva `TipoDocumento`):
   - `TipoDocumento.palabras_clave` se mantiene como texto `"palabra:peso"`, **pero** se agrega un campo auxiliar `TipoDocumento.keywords_obligatorias = JSONField(default=list)` con lista de strings.
3. Actualizar `clasificador.py` para leer `keywords_obligatorias` y aplicar el gate.
4. Actualizar el schema GraphQL:
   - `Documento` expone `score`, `keywordsMatcheadas`, `estado` (con el nuevo valor).
   - `TipoDocumento` expone `keywordsObligatorias`.
5. Actualizar `ingesta.py` para poblar `score` y `keywords_matcheadas` al crear el `Documento`. Si `es_dudosa`, `estado='dudosa'`. Si no hay match, `estado='sin_clasificar'`.
6. Actualizar el frontend (mínimo): mostrar `estado` correctamente en cualquier lista existente de documentos.

### Criterios de aceptación

- [x] Migraciones aplican sin errores sobre datos existentes (documentos previos con `estado='pendiente'` siguen válidos).
- [x] GraphQL expone los nuevos campos.
- [x] Un documento recién ingestado tiene `score` y `keywords_matcheadas` poblados.
- [x] El frontend no rompe con el nuevo valor `dudosa`.

### Notas

- No renombres `pendiente` a `sin_clasificar` si eso rompe datos. Puedes mantener ambos o mapear en el frontend. Decisión documentada.
- No agregues lógica de revisión humana aquí (eso es Fase 5).

### Registro

Completado el 2026-10-05 — `Documento.score`/`keywords_matcheadas`, `TipoDocumento.keywords_obligatorias`, estados `dudosa`/`sin_clasificar`, gate implementado, GraphQL + frontend + SDL actualizados. Suite: 135 tests.

**Decisiones documentadas:**
- Se conservan `pendiente`, `dudosa`, `sin_clasificar` y `verificado` como estados distintos. `pendiente` sigue siendo necesario porque hay datos históricos con ese valor y `deleteTipoDocumento` lo usa al desenlazar un tipo. `sin_clasificar` significa "el clasificador no encontró nada", que no es lo mismo que `dudosa` ("encontró algo pero la elección no es defendible").
- `keywords_obligatorias` actúa solo como puerta: si alguna falta, el tipo se descarta; si está, no suma al score. Se añadió `keywordsObligatorias` a `createTipoDocumento` y `updateTipoDocumento`.
- `documentosPendientes` ahora incluye `sin_clasificar` (son páginas sin clasificar, no estaban escondidas). Los `dudosa` ya tienen tipo asignado y quedan fuera de esa cola.
- `pendientes` en `documentosPersona` se calcula como `total - clasificados`, por lo que cubre los estados nuevos sin cambios.

**Bug preexistente detectado (fuera de alcance, no corregido):**
`DocumentosPendientes.tsx` y `CasilleroDocumentos.tsx` no revisan el valor de `estado`, solo lo muestran. Nada se rompe con los estados nuevos, pero tampoco se distingue un `dudosa` de un `clasificado` en pantalla. Queda para la Fase 5, que es donde aparecen las colas de revisión.

**Deuda técnica registrada:**
`apps/documentos/schema.py:131` tiene `@strawberry_django.type(TipoDocumento, fields=[... 'palabras_clave' ...])`. Para exponer el `JSONField` como `List[str]` y aceptar `keywordsObligatorias: [String!]` en las mutations, se necesitó un resolver explícito; la versión actual expone `keywordsObligatorias: JSON!`. Funciona y es consistente con `keywordsMatcheadas: JSON!`, pero el cliente tiene que castear. Corregirlo es trabajo de Fase 5 o posterior.

---

## FASE 5 — Colas de revisión: dudosas y sin clasificar

**Estado:** `BLOQUEADA` — la parte funcional está completa, probada y es usable (single-tenant desde FASE 17: queries sin `unidadId`, globales). El criterio de aislamiento por unidad quedó obsoleto; el bloqueo que subsiste es la falta de autenticación real (las guardas son UX, no seguridad). Ver Bloqueo conocido.

**Prioridad:** 🟡 Media

**Objetivo:** Exponer al usuario las páginas que el sistema no pudo clasificar con confianza, y permitirle corregir.

### Alcance

1. GraphQL:
   - Query `documentosDudosos(unidadId: ID!, limit: Int, offset: Int): [Documento!]!`
   - Query `documentosSinClasificar(unidadId: ID!, limit: Int, offset: Int): [Documento!]!`
   - Mutation `reclasificarDocumento(documentoId: ID!, tipoDocumentoId: ID!): Documento!` que:
     - Cambia `tipo_documento_id`, `estado='verificado'`, `score=null`.
     - Registra en un log (puede ser un `JSONField` en `Documento` llamado `historial_clasificacion` o una tabla nueva mínima `ClasificacionLog`).
2. Frontend:
   - Nueva ruta `/revision/dudosas` y `/revision/sin-clasificar`.
   - Cada tarjeta muestra: miniatura (si existe), texto OCR recortado, `keywords_matcheadas`, `score`, y un selector de `TipoDocumento`.
   - Botón "Confirmar" → mutation `reclasificarDocumento`.
3. Guardas de ruta en `react-router-dom`:
   - Rutas de revisión solo accesibles para roles `admin` y `operador`.
   - Redirigir a `/login` o `/` si no hay sesión.

### Criterios de aceptación

- [ ] ⚠️ Las dos queries devuelven solo documentos de la unidad del usuario autenticado. **Pendiente**: hoy filtran por el `unidadId` que envía el cliente, no por la sesión. Bloqueo documentado abajo.
- [x] La mutation persiste el cambio y deja rastro en el log.
- [x] Las rutas de revisión existen y están protegidas por rol.
- [x] Un usuario sin sesión no puede acceder a `/revision/*`.

### Notas

- No construyas dashboard con métricas. Solo las dos listas y la acción de reclasificar.
- Si no hay sistema de sesión funcional en el frontend todavía, documenta el bloqueo y deja las guardas como TODO con comentario claro.
- No toques la lógica de clasificación (Fase 3) ni el modelo base (Fase 4) más allá de lo estrictamente necesario.

### Registro

- `Documento.historial_clasificacion = JSONField(default=list)`. Entrada por
  reclasificación con `fecha`, `usuario`, `estado_anterior`, `tipo_anterior`,
  `tipo_nuevo`, `score_anterior` y `keywords_anteriores`. Se eligió el JSONField
  sobre una tabla nueva: el historial es de lectura para el revisor, nunca se
  consulta ni agrega en SQL.
- `apps/documentos/schema.py`: `documentos_dudosos` y `documentos_sin_clasificar`,
  ambas acotadas por `unidad_id` con `_paginar`. Devuelven `limit` sin tope
  superior, así que un cliente puede pedirlo todo; sin sesión es un problema
  known (ver bloqueo).
- `apps/documentos/mutations.py`: `reclasificar_documento`. Además de lo pedido
  pone `estado='verificado'`, `score=null`, `keywords_matcheadas=[]` y limpia
  `duplicado_de`. Validar que documento y tipo pertenezcan a la misma unidad:
  sin eso, un cliente podría asignar a un documento un tipo de otra unidad.
- Frontend: `AuthContext` + `ProtectedRoute`, rutas `/revision/dudosas` y
  `/revision/sin-clasificar` restringidas a `admin` y `operador`, páginas con
  miniatura, OCR recortado, keywords, score, selector de tipo e historial
  plegado. El logout pasó a `AuthContext` (`Layout` ya no recibe `onLogout`).
- El backend registra el usuario que reclasifica vía `_usuario_de(info)`, que
  hoy devuelve `None` porque no hay contexto GraphQL con la sesión.

### 🔴 Bloqueo conocido: aislamiento por unidad en el servidor

El primer criterio de aceptación **no se cumple** y no se puede cumplir sin
autenticación de verdad. El estado actual:

- `apps/users/schema.py:43` emite un token ficticio, `token=f"token-{user.id}"`.
- La vista GraphQL no inyecta la sesión en `info.context`, así que el backend
  no sabe quién es el usuario que pregunta.
- En consecuencia, `unidadId` es un valor que envía el cliente, no una
  propiedad derivada de la sesión. Un cliente modificado puede pedir la unidad
  que quiera.

Las guardas de ruta del frontend (`ProtectedRoute`, y los enlaces del sidebar
que se ocultan por rol) son **UX, no seguridad**: evitan que un usuario llegue
a la pantalla por error, no que acceda a datos. La sesión se guarda en
`localStorage` (`sistema_usuario`), lo que la hacetrivialmente falsificable.

Decisión tomada: documentar el bloqueo y no introducir JWT en esta fase, para
no mezclar un cambio de autenticación con uno de colas de revisión. Cuando se
ataque la autenticación, hay que cerrar esto junto con `FASE 15.A/15.B`, que
ya estaba identificada en este archivo.

Avance el 2026-10-05 — `historial_clasificacion`, `documentosDudosos`,
`documentosSinClasificar`, `reclasificarDocumento`, `AuthContext` +
`ProtectedRoute`, rutas `/revision/*` con páginas y el logout movido al
contexto. `test_revision.py` (26 tests) y suite completa en verde. Se marca
`BLOQUEADA` y no `COMPLETADO` por el criterio de aislamiento, según la regla 5
de este documento.

---

## FASE 6 — Deduplicación por pHash (opcional / fase 2)

**Estado:** `COMPLETADO CON DESVIACIÓN` (deduplicación global desde FASE 17: `buscar_duplicado(phash)` sin `unidad_id`)

**Prioridad:** 🟢 Baja

**Objetivo:** Detectar páginas duplicadas dentro de la misma unidad.

### Alcance

1. Agregar dependencias: `Pillow`, `imagehash` a `requirements/base.txt`.
2. En `pdf_processor.py`, al iterar páginas, generar thumbnail PNG de cada página con `fitz` (resolución baja, ej. 150 DPI) y subirla a MinIO en `personas/{codigo}/thumbs/{uuid}.png`.
3. Calcular `pHash` del thumbnail y guardarlo en `Documento.phash = CharField(max_length=64, null=True, blank=True, db_index=True)`.
4. En ingesta, antes de crear un `Documento`, buscar en la misma unidad un `Documento` con `phash` a distancia Hamming ≤ 5. Si existe, marcar el nuevo como `estado='duplicado'` (nuevo valor) y guardar referencia `duplicado_de = ForeignKey('self', null=True)`.
5. GraphQL: query `documentosDuplicados(unidadId: ID!)`.
6. Frontend: mostrar badge "Duplicado" en listas.

### Criterios de aceptación

- [x] Cada `Documento` nuevo tiene `phash` calculado.
- [x] Un documento duplicado se marca como tal y no se cuenta dos veces en métricas.
- [x] ⚠️ Los thumbnails se almacenan en MinIO bajo el prefijo correcto. **Desviado**: no se guardan miniaturas en MinIO. Ver Notas.

### Notas

- Esta fase **duplica almacenamiento**. Documentar el costo.
- Si el volumen actual es bajo (< 1000 docs), considerar posponerla.
- No re-procesar documentos históricos en esta fase. Solo aplicar a nuevos.

### Desviación: sin miniaturas en MinIO

El paso 2 del alcance pedía subir un PNG por página a
`personas/{codigo}/thumbs/{uuid}.png`. **No se hizo, por decisión del usuario.**

Motivo: el thumbnail solo se usa para la miniatura de las tarjetas de revisión.
Subir ~1 PNG por página duplica objetos, ancho de banda y costo de MinIO para
guardar una imagen que el backend ya sabe regenerar. El proyecto ya tenía
`DocumentoThumbnailView`, que renderiza la miniatura bajo demanda desde el PDF
original en MinIO y la cachea en HTTP; reutilizarlo da la misma imagen sin
guardar nada nuevo.

Consecuencias:

- El `pHash` se calcula en memoria: se renderiza la página a `0.5` de escala con
  PyMuPDF, se pasa a Pillow y de ahí a `imagehash.phash`. El PNG existe solo
  durante la petición.
- El hash es determinístico para un mismo PDF y un mismo tamaño de render, así
  que sigue siendo comparable entre documentos subidos en momentos distintos.
- No hay re-hash masivo pendiente: si algún día cambia el tamaño de render, los
  `phash` viejos dejan de ser comparables con los nuevos y habría que recalcular.

### Registro

- `Documento.phash = CharField(max_length=64, null=True, blank=True, db_index=True)`.
- `Documento.duplicado_de = ForeignKey('self', null=True, blank=True, on_delete=SET_NULL, related_name='duplicados')`.
  `SET_NULL` y no `CASCADE` a propósito: si el original se borra, el duplicado
  sobrevive como documento normal en vez de desaparecer con él.
- `estado='duplicado'` agregado a `ESTADO_CHOICES`.
- `apps/documentos/deduplicacion.py`: `UMBRAL_HAMMING = 5`,
  `distancia_hamming()`, `son_duplicados()` y `buscar_duplicado(phash, unidad_id)`.
  La búsqueda compara en minúsculas y solo contra documentos de la misma unidad
  con `phash` no vacío.
- `ingesta.py` busca **antes** de crear, no después: el duplicado es el que ya
  existía, así que buscar primero evita que una segunda copia del mismo PDF se
  marque a sí misma. Cubre también páginas repetidas dentro de un mismo archivo.
- La métrica de documentos por persona excluye `duplicado` del conteo de
  clasificados; si no, el expediente de una persona podría inflar su %.
- Frontend: query `documentosDuplicados`, cola `/revision/duplicados`, y el
  badge de estado (incluido "Duplicado") en `VistaPersonaDocumentos` y
  `CasilleroDocumentos`. En la cola de duplicados se muestran lado a lado la
  miniatura del duplicado y la del original, porque es la única forma de que un
  humano confirme que son la misma página.
- `requirements/base.txt`: `imagehash==4.3.1` más sus dependencias fijadas
  (`numpy`, `scipy`, `PyWavelets`) para que el entorno sea reproducible.
- Los documentos históricos **no** se reprocesaron: quedan con `phash=null` y
  no participan en la deduplicación, según la nota de alcance.

Completado el 2026-10-05 — `phash` + `duplicado_de` + estado `duplicado`,
`deduplicacion.py` con Hamming ≤ 5 acotado por unidad, detección en la ingesta
(contando páginas repetidas dentro de un mismo PDF), query
`documentosDuplicados`, cola `/revision/duplicados` y badge de estado.
`test_deduplicacion.py` (14) + `test_ingesta.py` (7). Suite: 182 tests.

---

## FASE 7 — Sugerencia automática de keywords (feedback loop)

**Estado:** `INCOMPLETO`

**Prioridad:** 🟢 Baja

**Objetivo:** Usar las correcciones humanas de Fase 5 para sugerir nuevas keywords y pesos.

### Alcance

1. Job de management command: `sugerir_keywords --unidad=<slug>`.
2. Algoritmo:
   - Tomar todos los `Documento` con `estado='verificado'` y su `texto_extraido`.
   - Para cada `TipoDocumento`, calcular frecuencia de palabras (tras `normalizar()`) en documentos de ese tipo vs. en el resto.
   - Proponer top-N palabras con mayor ratio (tipo / resto) que **no** estén ya en `palabras_clave`.
3. Guardar sugerencias en un modelo nuevo `SugerenciaKeyword(tipo_documento, palabra, ratio, frecuencia, aceptada=null, created_at)`.
4. GraphQL: query `sugerenciasKeyword(tipoDocumentoId: ID!)` y mutation `aceptarSugerencia(id: ID!, peso: Int!)` que agrega la keyword al tipo.
5. Frontend: en la pantalla de edición de `TipoDocumento`, mostrar sugerencias pendientes con botón "Aceptar" / "Descartar".

### Criterios de aceptación

- [ ] El comando corre sin errores sobre una unidad con al menos 10 documentos verificados.
- [ ] Las sugerencias no incluyen palabras ya presentes en `palabras_clave`.
- [ ] Aceptar una sugerencia actualiza `TipoDocumento.palabras_clave` correctamente.

### Notas

- No apliques sugerencias automáticamente. Siempre requieren confirmación humana.
- No uses IA aquí. Es estadística simple.
- Si hay menos de 10 documentos verificados, el comando debe advertir y salir limpiamente.

---

## Resumen de fases

| Fase | Nombre | Prioridad | Estado |
|------|--------|-----------|--------|
| 1 | Corrección de aislamiento multi-tenant en ingesta | 🔴 Crítica | `OBSOLETA` (FASE 17) |
| 2 | Bug del few-shot en `GeminiClassifier` | 🔴 Crítica | `ELIMINADA` (sin-IA) |
| 3 | Clasificador local robusto (normalización + fuzzy + score) | 🟠 Alta | `COMPLETADO` |
| 4 | Modelo de datos: score, dudosa y keywords obligatorias | 🟠 Alta | `COMPLETADO` |
| 5 | Colas de revisión: dudosas y sin clasificar | 🟡 Media | `BLOQUEADA` (falta autenticación; queries ya globales) |
| 6 | Deduplicación por pHash (opcional) | 🟢 Baja | `COMPLETADO` (sin miniaturas en MinIO; dedup global) |
| 7 | Sugerencia automática de keywords (feedback loop) | 🟢 Baja | `INCOMPLETO` |
| 17 | Eliminación total de Unidad (single-tenant) | 🔴 Crítica | `COMPLETADO` 2026-10-09 |

---

## FASE 17 — Eliminación total de Unidad (single-tenant)

**Estado:** `COMPLETADO`

**Prioridad:** 🔴 Crítica (decisión del usuario 2026-10-09: la unidad ya no se maneja así)

**Objetivo:** Sistema sin `Unidad` en backend ni frontend. `codigo` y `slug` únicos globales.

### Cambios realizados

**Backend:**
| Archivo | Cambio |
|---|---|
| `apps/unidades/` | App vaciada (sin modelos ni API): `models.py` vacío, borrados `schema.py` y `admin.py`. Se conserva en `INSTALLED_APPS` solo por historia de migraciones |
| `apps/unidades/migrations/0003_delete_unidad.py` | Nueva: `DeleteModel Unidad` (depende de las remociones de FKs) |
| `apps/personas/models.py` | Quitado FK `unidad`; `codigo` con `unique=True` |
| `apps/documentos/models.py` | Quitado FK `unidad` de `TipoDocumento`; `slug` con `unique=True` |
| `apps/personas/migrations/0006_...` | `RemoveField unidad` + `AlterField codigo unique` (+ DROP del índice LIKE huérfano de la 0004) |
| `apps/documentos/migrations/0013_...` | `RemoveField unidad` + `AlterField slug unique` (+ DROP del índice LIKE huérfano de la 0008) |
| `apps/personas/schema.py`, `apps/documentos/schema.py` | Quitado arg `unidadId` de `personas`, `tiposDocumento`, `documentosPendientes`, `documentosDudosos`, `documentosSinClasificar`, `documentosDuplicados` |
| `apps/personas/mutations.py`, `apps/documentos/mutations.py` | Quitado `unidad_id` de creates; quitadas validaciones "otra unidad"; `reclasificar_todos()` sin filtro |
| `config/schema.py` | Sin `UnidadQuery`/`UnidadMutation` |
| `apps/storage/ingesta.py`, `pdf_processor.py`, `deduplicacion.py`, `documentos/views.py` | Sin parámetro `unidad`; `resolver_persona(codigo)`, `buscar_duplicado(phash)` global; `UploadBatchPDFView` ya no pide `unidad_id` |
| `apps/tests/` | `datos.py` sin unidades (desactiva seeds de tipos); `test_aislamiento.py` reescrito a resolución por código; resto sin `unidadId`/`otra_unidad`; `test_contrato.py` sin ops de unidad |
| `docs/schema.graphql` | Regenerado sin unidad |

**Frontend:**
| Archivo | Cambio |
|---|---|
| `shared/contexts/UnidadContext.tsx`, `graphql/queries/unidades.ts`, `graphql/mutations/unidades.ts`, `modules/configuracion/pages/Unidades.tsx` | **Borrados** |
| `main.tsx` | Sin `UnidadProvider` |
| `shared/components/layout/Layout.tsx` | Sin selector de unidad ni nav "Unidades" (título "Sistema de Digitalización") |
| `config/routes.tsx`, `config/constants.ts` | Sin ruta `/configuracion/unidades` |
| `shared/types/index.ts` | Sin `Unidad`; `Persona`/`TipoDocumento` sin `unidad` |
| Todas las páginas + `useColaRevision` | Sin `useUnidad`, sin `unidadId`, sin `skip:!unidadActiva`; `SubirDocumentos` sin `unidad_id` en FormData |
| Queries/mutations graphql | Sin `$unidadId` |

### Deuda conocida
- La app `apps/unidades` vacía debe quedarse en `INSTALLED_APPS` hasta squashear migraciones (las viejas la referencian).
- Los seeds históricos siembran 4 personas y 17 tipos: los tests los descuentan con `search` y membresía en vez de conteos absolutos.
- `tareas.md` F1-F6, F15.C y Refino F1 marcadas obsoletas por esta fase.

Completado el 2026-10-09 — single-tenant global, tabla `unidades` borrada, suite 145 tests en verde + `npm run build` OK.

---

## Reglas globales para la IA ejecutora

1. **Una fase a la vez.** No mezcles cambios de dos fases en un mismo commit/PR.
2. **No toques `core/`** raíz bajo ninguna circunstancia.
3. **No introduzcas dependencias** fuera de las indicadas en cada fase.
4. **Respeta el stack existente.** No migres a DRF, no cambies GraphQL por REST, no agregues ORM alternativo.
5. **Cada fase debe dejar el sistema funcional.** Si una fase no puede completarse sin otra, márcala como `BLOQUEADA` con una nota explicando el bloqueo, en lugar de dejarla `INCOMPLETO`.
6. **Al terminar una fase**, actualiza su estado a `COMPLETADO` en este documento y agrega debajo una línea: `Completado el <fecha> — <resumen de 1 línea>`.
7. **Si detectas un bug fuera del alcance** de la fase actual, no lo arregles. Agrégalo como nota bajo la fase correspondiente o créale una fase nueva al final del documento si es crítico.