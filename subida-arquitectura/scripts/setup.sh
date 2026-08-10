#!/bin/bash
# Script de configuracion inicial del proyecto

set -e

echo "=== Configurando Sistema de Digitalizacion de Archivos ==="

# Verificar si existe .env
if [ ! -f "../.env" ]; then
    echo "Creando archivo .env desde .env.example..."
    cp ../.env.example ../.env
    echo "Por favor edita el archivo .env con tus configuraciones"
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker no esta instalado"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose no esta instalado"
    exit 1
fi

echo "Construyendo imagenes Docker..."
docker-compose build

echo "Iniciando servicios..."
docker-compose up -d

echo "Esperando a que los servicios esten listos..."
sleep 10

echo "Ejecutando migraciones..."
docker-compose exec backend python manage.py migrate

echo "=== Configuracion completada ==="
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8000"
echo "Admin: http://localhost:8000/admin/"
echo "MinIO: http://localhost:9001"
