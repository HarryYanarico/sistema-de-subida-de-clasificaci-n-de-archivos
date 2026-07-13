# Sistema de Digitalización de Archivos

Sistema para gestión y clasificación automática de documentos escaneados de personas.

## Requisitos Previos

- Python 3.10+
- Node.js 18+
- Docker y Docker Compose
- PostgreSQL (se ejecuta via Docker)
- MinIO (se ejecuta via Docker)

## Instalación

### 1. Iniciar servicios (PostgreSQL + MinIO)

```bash
docker-compose up -d
```

### 2. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Crear base de datos
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Ejecutar seeders (tipos de documento)
python manage.py shell -c "from apps.documentos.seeders import seed_tipos_documento; seed_tipos_documento(None, None)"

# Iniciar servidor
python manage.py runserver
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## URLs

- **Frontend**: http://localhost:5173
- **Backend (GraphQL)**: http://localhost:8000/graphql/
- **Admin Django**: http://localhost:8000/admin/
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

## Estructura del Proyecto

```
sistema-digitalizacion/
├── backend/
│   ├── apps/
│   │   ├── users/          # Autenticación y usuarios
│   │   ├── personas/       # Gestión de personas
│   │   ├── documentos/     # Tipos de documento y documentos
│   │   └── storage/        # Servicio MinIO y procesamiento PDF
│   └── config/             # Configuración Django
├── frontend/
│   └── src/
│       ├── components/     # Componentes UI (shadcn/ui)
│       ├── graphql/        # Queries y mutations GraphQL
│       ├── pages/          # Páginas de la aplicación
│       └── types/          # Tipos TypeScript
└── docker-compose.yml      # PostgreSQL y MinIO
```

## Funcionalidades

- **Gestión de Personas**: Registrar, editar, eliminar personas
- **Tipos de Documento**: Crear y gestionar tipos dinámicamente
- **Upload de PDFs**: Subir múltiples PDFs por persona
- **Clasificación Automática**: Extracción de texto y búsqueda por palabras clave
- **Vista Casillero**: Visualización de documentos asignados por persona
- **Revisión Manual**: Reasignar documentos incorrectamente clasificados
