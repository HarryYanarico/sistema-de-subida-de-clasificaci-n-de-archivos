# Sistema de Digitalización de Archivos

Sistema para escanear PDFs que contienen múltiples documentos de una persona
en orden aleatorio, separarlos, clasificarlos automáticamente y asignarlos a su
casillero digital. Context: UAGRM (Bolivia).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, TailwindCSS, shadcn/ui, Apollo Client, GraphQL |
| Backend | Python 3.10, Django 4.2, Graphene (GraphQL), DRF, django-cors-headers |
| Almacenamiento | MinIO (S3-compatible, boto3) para los PDFs |
| Clasificación | PyMuPDF (extracción de texto) + Gemini (`google-genai`) |
| Base de datos | **PostgreSQL nativo — NO corre en Docker** |
| Orquestación | Docker Compose, solo para MinIO, backend y frontend |

## Requisitos previos

- Python 3.10+
- Node.js 18+
- Docker y Docker Compose
- **PostgreSQL 15+ instalado de forma nativa** (no vía Docker), con la base
  `digitalizacion` creada y las migraciones aplicadas
- Una API key de Gemini (Google AI Studio)

> **PostgreSQL no está en Docker por diseño.** Docker levanta únicamente MinIO,
> el backend y el frontend. La base corre en el host y el backend la alcanza vía
> `host.docker.internal`.

## Instalación

### 1. Configurar el `.env`

```bash
cd subida-arquitectura
cp .env.example .env
```

Editá `.env` con tus credenciales reales. Las dos variables que importan:

```bash
# La base es nativa en el host. El backend corre DENTRO de Docker, por eso
# necesita host.docker.internal para alcanzarla.
POSTGRES_HOST=host.docker.internal
POSTGRES_PORT=5432
```

> Si vas a ejecutar Django **fuera** de Docker (venv local), poné
> `POSTGRES_HOST=localhost` en `subida-backend/.env`.

### 2. Crear la base de datos (una sola vez, sobre el Postgres nativo)

```bash
psql -U postgres -c "CREATE DATABASE digitalizacion;"
```

### 3. Levantar el stack

```bash
cd subida-arquitectura
docker compose up -d --build
```

Esto levanta MinIO, el backend (que aplica las migraciones al arrancar) y el
frontend. El backend queda en `http://localhost:8000`.

### 4. Frontend

Si lo levantás con Docker Compose, no hace falta nada más. Para desarrollo
local con recarga en caliente:

```bash
cd subida-frontend
npm install
npm run dev
```

### 5. Superusuario (opcional, para el admin de Django)

```bash
docker compose exec backend python manage.py createsuperuser
```

## Desarrollo local sin Docker para el backend

```bash
cd subida-backend
python -m venv venv
venv\Scripts\activate            # Windows
# source venv/bin/activate       # Linux/Mac

pip install -r requirements/development.txt
python manage.py migrate
python manage.py runserver
```

> No hay `requirements.txt` en la raíz del backend. Los archivos viven en
> `requirements/`: `base.txt` (común), `development.txt` y `production.txt`.
> Ambos parten de `base.txt` con `-r base.txt`.

> **Los datos iniciales ya se siembran solos.** No corras ningún seeder: los
> tipos de documento van en la migración `0004_seed_tipos_documento`, las
> personas iniciales en `0005_seed_personas_iniciales` y la unidad raíz en
> `apps/unidades/migrations/0002_migrar_datos_iniciales.py`. Los módulos
> `seeders` ya no existen.

## URLs

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| GraphQL (incluye GraphiQL) | http://localhost:8000/graphql/ |
| Admin Django | http://localhost:8000/admin/ |
| MinIO Console | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| API REST (upload) | http://localhost:8000/api/upload/ |

## Estructura del proyecto

```
sistema-digitalizacion/
├── subida-backend/                  # Django + Graphene
│   ├── apps/
│   │   ├── documentos/              # TipoDocumento, Documento, mutations, classifier
│   │   ├── personas/                # Persona + casillero
│   │   ├── unidades/                # Unidad organizacional
│   │   ├── users/                   # Custom User
│   │   └── storage/                 # servicios: MinIO, PyMuPDF, Gemini (no es app Django)
│   ├── config/
│   │   ├── settings/                # base.py / development.py / production.py
│   │   ├── schema.py                # Query y Mutation raíz
│   │   └── urls.py                  # admin, graphql, endpoints REST
│   └── requirements/                # base / development / production
│
├── subida-frontend/                 # React + Vite + TS
│   └── src/
│       ├── modules/                 # auth, personas, documentos, configuracion
│       ├── shared/
│       │   ├── components/          # layout + ui (shadcn)
│       │   ├── contexts/            # UnidadContext
│       │   └── graphql/             # queries y mutations
│       └── config/                  # constantes y rutas
│
└── subida-arquitectura/             # infraestructura
    ├── docker-compose.yml           # MinIO + backend + frontend (sin Postgres)
    ├── docker-compose.override.yml  # modo desarrollo con volumes
    ├── docker/
    │   ├── backend/Dockerfile
    │   └── frontend/Dockerfile
    ├── scripts/                     # setup.sh, backup.sh
    └── .env / .env.example
```

## Funcionalidades

- **Gestión de personas**: alta, edición, baja y casillero digital por persona.
- **Múltiples unidades organizacionales**: personas, tipos de documento y
  consultas están aisladas por unidad; el selector vive en el header.
- **Tipos de documento**: CRUD, con `palabras_clave` que alimentan la
  clasificación local.
- **Subida de PDFs**: individual y por lotes, con renombrado automático y
  asignación a la persona.
- **Clasificación automática**: extracción de texto con PyMuPDF, coincidencia
  por palabras clave y, si no alcanza, Gemini.
- **IA para crear tipos**: desde el diálogo de sugerencia se puede crear y
  asignar un tipo de documento nuevo y reclasificar.
- **Revisión manual**: reasignar documentos mal clasificados y ver pendientes.

## Backup

`subida-arquitectura/scripts/backup.sh` genera un `pg_dump` de la base nativa.
Detecta `pg_dump` solo (en el PATH o en `C:\Program Files\PostgreSQL\*\bin`) y
lee las credenciales del `.env`.

```bash
cd subida-arquitectura
./scripts/backup.sh
```

Los dumps van a `subida-arquitectura/backups/` y se purgan los de más de 7 días.

> **Limitación conocida:** el backup cubre solo la base de datos. Los PDFs viven
> en el volumen de Docker `minio_data` y **no** están incluidos. Tampoco hay un
> script de restauración.
