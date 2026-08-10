#!/bin/bash
# Script de despliegue para produccion

set -e

echo "=== Desplegando Sistema de Digitalizacion ==="

# Verificar que existe .env.production
if [ ! -f "../.env.production" ]; then
    echo "ERROR: Archivo .env.production no encontrado"
    exit 1
fi

echo "Construyendo imagenes para produccion..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml build

echo "Deteniendo servicios anteriores..."
docker-compose down

echo "Iniciando servicios en produccion..."
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d

echo "=== Despliegue completado ==="
