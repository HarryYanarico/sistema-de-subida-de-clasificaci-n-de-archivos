# Plan: Soporte para Múltiples Unidades Organizacionales

## FASE 1: Backend — Modelos y Migración ✅ COMPLETADA

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

## FASE 2: Backend — GraphQL ✅ COMPLETADA

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

## FASE 3: Frontend — Contexto y Tipos ✅ COMPLETADA

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

## FASE 4: Frontend — Queries y Mutations ✅ COMPLETADA

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

## FASE 5: Frontend — UI ✅ COMPLETADA

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

## FASE 6: Ajustes Finales ✅ COMPLETADA

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

## FASE 9: Visor de Documentos con Cards Difuminadas

### Descripción
Nuevo módulo con dos rutas: una lista de personas con filtro de búsqueda e indicador de documentos clasificados, y una vista de documentos por persona con cards de previsualización difuminada que se expanden inline.

---

### 9.1 Backend — Nuevo campo en query `personas`
**Archivo:** `backend/apps/personas/schema.py`

Agregar campo `tiene_documentos_clasificados: Boolean` al `PersonaType`:
```python
tiene_documentos_clasificados = graphene.Boolean()

def resolve_tiene_documentos_clasificados(self, info):
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
