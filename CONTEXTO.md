# Contexto del Proyecto: Sistema de Digitalización de Archivos

## Descripción General

Sistema web para la gestión y clasificación automática de documentos escaneados de personas. Diseñado para un contexto universitario en Bolivia, permite cargar múltiples PDFs (escaneados de personas), dividirlos en páginas individuales, extraer texto y clasificarlos automáticamente en categorías predefinidas (constancias, certificados, formularios, etc.).

**Problema que resuelve:** Cada persona tiene documentos escaneados en PDF donde los documentos internos no siguen un orden fijo. El sistema separa las páginas, identifica qué documento es cada una y las asigna automáticamente al casillero correspondiente de cada persona.

## Stack Tecnológico

### Backend
| Tecnología | Versión | Propósito |
|---|---|---|
| Python | 3.10+ | Lenguaje principal |
| Django | 4.2.16 | Framework web |
| Graphene-Django | 3.1.5 | API GraphQL |
| PostgreSQL | 15 (Alpine) | Base de datos |
| MinIO | latest | Almacenamiento de objetos (S3-compatible) para PDFs |
| PyMuPDF (fitz) | 1.24.5 | Procesamiento de PDFs (división, extracción de texto, thumbnails) |
| boto3 | 1.34.144 | Cliente MinIO/S3 |
| psycopg2-binary | 2.9.9 | Adaptador PostgreSQL |
| django-cors-headers | 4.4.0 | Manejo de CORS |

### Frontend
| Tecnología | Versión | Propósito |
|---|---|---|
| React | 18.3.1 | Librería UI |
| TypeScript | 5.5.3 | Tipado estático |
| Vite | 5.4.0 | Build tool / dev server |
| Apollo Client | 3.11.0 | Cliente GraphQL |
| Tailwind CSS | 3.4.6 | Estilos utility-first |
| shadcn/ui (Radix) | - | Componentes UI accesibles |
| Lucide React | 0.400.0 | Iconos |
| React Router DOM | 6.26.0 | Enrutamiento SPA |

### Infraestructura
- **Docker Compose:** 4 servicios (PostgreSQL, MinIO, Backend, Frontend)
- **Puertos:** Backend `:8000`, Frontend `:5173`, PostgreSQL `:5432`, MinIO `:9000`/`:9001`
- **Zona horaria:** America/La_Paz (Bolivia)
- **Idioma:** Español (`es-bo`)

## Arquitectura

```
sistema-digitalizacion/
├── backend/
│   ├── apps/
│   │   ├── users/              # Modelo de usuario (admin/operador)
│   │   │   └── models.py       # User (AbstractUser + role, telefono)
│   │   ├── personas/           # Gestión de personas
│   │   │   └── models.py       # Persona (codigo, nombres, apellidos, ci, email...)
│   │   ├── documentos/         # Tipos de documento y documentos
│   │   │   ├── models.py       # TipoDocumento (categorias + palabras_clave)
│   │   │   │                   # Documento (pagina individual + estado)
│   │   │   └── seeders.py      # 17 tipos de documento precargados
│   │   └── storage/            # Servicio de almacenamiento (no es app Django)
│   │       ├── services.py     # MinIOService (upload, download, delete, URLs)
│   │       └── pdf_processor.py # PDFProcessor (split, OCR, clasificación)
│   ├── config/
│   │   ├── settings.py         # Configuración Django
│   │   ├── schema.py           # Schema GraphQL unificado
│   │   └── urls.py             # URLs REST y GraphQL
│   ├── .env                    # Variables de entorno
│   ├── requirements.txt        # Dependencias Python
│   └── Dockerfile              # Python 3.10-slim
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── layout/         # Layout.tsx (sidebar responsive + topbar)
│       │   └── ui/             # Componentes shadcn/ui (button, card, badge, table, dialog, input, label, select, progress)
│       ├── graphql/
│       │   ├── client.ts       # Apollo Client instance
│       │   ├── queries/        # personas.ts, documentos.ts
│       │   └── mutations/      # auth.ts, personas.ts, documentos.ts
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── personas/       # ListaPersonas, RegistrarPersona, CasilleroDocumentos
│       │   ├── documentos/     # SubirDocumentos
│       │   └── configuracion/  # TiposDocumento
│       ├── types/index.ts      # Interfaces TypeScript
│       └── lib/utils.ts        # cn() utility
├── docker-compose.yml          # PostgreSQL + MinIO + Backend + Frontend
└── Notas sistema digitalizacion.txt  # Notas y bugs conocidos
```

### Flujo de Datos

```
[PDF Upload] ──► UploadBatchPDFView (REST API)
                    │
                    ▼
              PDFProcessor.process_pdf()
                    │
                    ├─► PyMuPDF: dividir PDF en páginas individuales
                    ├─► Extraer texto de cada página
                    ├─► MinIO: subir PDF original + PDFs individuales por página
                    └─► Clasificar cada página por coincidencia de palabras clave
                    │
                    ▼
              Registros Documento en PostgreSQL
                    │
                    ▼
[Frontend] ──► GraphQL queries (listar personas, ver documentos, pendientes)
            ──► GraphQL mutations (clasificar, asignar, CRUD)
            ──► REST API (ver archivo/original/thumbnail vía MinIO)
```

## Modelos de Datos

### User (`apps.users`)
| Campo | Tipo | Descripción |
|---|---|---|
| `role` | CharField | `admin` o `operador` |
| `telefono` | CharField | Teléfono (opcional) |
| + campos de AbstractUser | | username, email, password, first_name, last_name... |

### Persona (`apps.personas`)
| Campo | Tipo | Descripción |
|---|---|---|
| `codigo` | CharField(20) | Código único (ej: `216013731`) |
| `nombres` | CharField(255) | Nombres |
| `apellidos` | CharField(255) | Apellidos |
| `ci` | CharField(20) | Carnet de Identidad |
| `email` | EmailField | Email (opcional) |
| `telefono` | CharField(20) | Teléfono (opcional) |
| `created_at` / `updated_at` | DateTimeField | Timestamps |

### TipoDocumento (`apps.documentos`)
| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | CharField(255) | Nombre del tipo (ej: "Certificado de Nacimiento") |
| `slug` | SlugField | Slug único auto-generado |
| `palabras_clave` | TextField | Palabras clave separadas por coma para clasificación automática |
| `es_obligatorio` | BooleanField | Si es documento obligatorio |
| `orden` | IntegerField | Orden de visualización |
| `activo` | BooleanField | Si está activo |

### Documento (`apps.documentos`)
| Campo | Tipo | Descripción |
|---|---|---|
| `persona` | FK → Persona | Persona propietaria |
| `tipo_documento` | FK → TipoDocumento | Tipo asignado (nullable) |
| `archivo_original` | CharField(500) | Ruta en MinIO del PDF original |
| `archivo_pagina` | CharField(500) | Ruta en MinIO de la página individual |
| `pagina_numero` | IntegerField | Número de página en el PDF original |
| `texto_extraido` | TextField | Texto extraído de la página |
| `estado` | CharField(20) | `clasificado`, `pendiente` o `verificado` |

### Tipos de Documento Precargados (Seeders)
Constancia de Cambio de Carrera, Comprobante de Pago, Solicitud de Cambio de Carrera, Histórico Académico, Certificado de No Deudor, Test Psicotécnico, Fotocopia de CI, Solicitud de Retiro Voluntario, Recibo de Retiro Temporal, Formulario Incentivo Empadronador, Certificado de Nacimiento, Diploma de Bachiller (Anverso/Reverso), Ficha de Datos Personales (Anverso/Reverso), Seguro Social Universitario (Anverso/Reverso).

## API

### GraphQL (`/graphql/`)

#### Queries
| Query | Descripción |
|---|---|
| `personas(search, page, limit)` | Lista paginada y buscable de personas |
| `persona(id)` | Persona por ID |
| `tiposDocumento(activo)` | Lista de tipos de documento |
| `tipoDocumento(id)` | Tipo de documento por ID |
| `documentosPersona(personaId)` | Todos los documentos de una persona + estadísticas |
| `documentosPendientes` | Documentos sin clasificar |

#### Mutations
| Mutation | Descripción |
|---|---|
| `loginUser(username, password)` | Autenticación (token pseudo-aleatorio) |
| `createUser(...)` | Crear usuario |
| `createPersona(...)` | Crear persona |
| `updatePersona(...)` | Actualizar persona |
| `deletePersona(id)` | Eliminar persona |
| `createTipoDocumento(...)` | Crear tipo de documento |
| `updateTipoDocumento(...)` | Actualizar tipo de documento |
| `deleteTipoDocumento(id)` | Eliminar tipo de documento |
| `asignarDocumento(documentoId, tipoDocumentoId)` | Asignar tipo a documento manualmente |
| `clasificarDocumento(documentoId)` | Re-ejecutar clasificación automática |

### REST Endpoints
| URL | Método | Descripción |
|---|---|---|
| `api/upload/` | POST | Subir PDF(s) para una persona específica |
| `api/upload/batch/` | POST | Subida batch: archivos nombrados con código de persona (8-9 dígitos) |
| `api/documents/<id>/file/` | GET | Servir PDF de la página individual |
| `api/documents/<id>/original/` | GET | Servir PDF original completo |
| `api/documents/<id>/thumbnail/` | GET | Thumbnail PNG de la primera página |
| `admin/` | GET | Panel de administración Django |

## Funcionalidades Principales

1. **Gestión de Personas:** CRUD completo con código único, búsqueda y paginación
2. **Subida Batch de PDFs:** Drag-and-drop, validación por nombre de archivo (código de persona), procesamiento automático
3. **Procesamiento de PDFs:** División en páginas individuales, extracción de texto, generación de thumbnails
4. **Clasificación Automática:** Coincidencia de palabras clave contra tipos de documento predefinidos
5. **Casillero de Documentos:** Vista visual tipo "casillero" por persona, mostrando slots por cada tipo de documento
6. **Revisión Manual:** Reasignación de tipos de documento a páginas clasificadas incorrectamente
7. **Gestión de Tipos de Documento:** CRUD de categorías con palabras clave, orden y obligatoriedad

## Configuración

### Variables de Entorno (`.env` del backend)
```env
DJANGO_SECRET_KEY=django-insecure-change-this-in-production
DEBUG=True
POSTGRES_DB=digitalizacion
POSTGRES_USER=admin
POSTGRES_PASSWORD=secret123
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=digitalizacion
MINIO_USE_SSL=False
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### URLs de Servicios
| Servicio | URL |
|---|---|
| Frontend (dev) | http://localhost:5173 |
| Backend (GraphQL) | http://localhost:8000/graphql/ |
| Admin Django | http://localhost:8000/admin/ |
| MinIO Console | http://localhost:9001 (minioadmin/minioadmin) |
| PostgreSQL | localhost:5432 |

## Estado Actual y Notas Conocidas

### Funcionalidades pendientes / incompletas
- **Autenticación real:** El sistema genera tokens pseudo-aleatorios (`token-{user.id}`) pero no hay middleware de validación ni protección de endpoints
- **Dashboard:** Solo muestra total de personas; las demás estadísticas están como placeholder (`--`)
- **Mutaciones sin UI:** `UPDATE_PERSONA`, `DELETE_PERSONA`, `UPDATE_TIPO_DOCUMENTO`, `CLASIFICAR_DOCUMENTO` están definidas pero no tienen interfaz
- **Query sin uso:** `GET_DOCUMENTOS_PENDIENTES` está definida pero no se consume en ninguna página
- **Estado `verificado`:** Existe como opción pero nunca se asigna en el código

### Bugs / Notas del archivo de notas
- El visor de documentos (iframe) puede fallar con "La página localhost ha rechazado la conexión"
- El botón de imprimir no funciona correctamente
- Cada persona puede tener muchos tipos de documentos asignados, y el PDF escaneado contiene documentos en orden aleatorio

### Dependencias no utilizadas
- `djangorestframework`, `django-filter`, `Pillow` (backend)
- `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip` (frontend)

### Observaciones técnicas
- La clasificación es pura coincidencia de subcadenas (sin ML/NLP)
- El token se limpia del localStorage en cada carga de página
- Híbrido GraphQL (CRUD) + REST (upload, file serving)
- Límite de subida: 50 MB
