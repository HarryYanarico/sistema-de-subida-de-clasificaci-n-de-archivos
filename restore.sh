#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

if [ $# -ne 1 ]; then
    echo "Uso: $0 <archivo_exportacion.tar.gz>"
    echo "Ejemplo: $0 export_20250713_100200.tar.gz"
    exit 1
fi

ARCHIVE="$1"

if [ ! -f "$ARCHIVE" ]; then
    echo "Error: No se encuentra el archivo '$ARCHIVE'"
    exit 1
fi

echo "============================================"
echo " Restaurando Sistema de Digitalización"
echo "============================================"

EXTRACT_DIR="${ARCHIVE%.tar.gz}"
echo "Archivo: $ARCHIVE"

# 1. Extraer archivo
echo "Extrayendo archivo..."
rm -rf "$EXTRACT_DIR"
tar xzf "$ARCHIVE"
echo "  ✓ Extraído en $EXTRACT_DIR/"

# 2. Verificar contenedores
echo "Verificando servicios..."
docker-compose up -d postgres minio
echo "  ✓ Servicios iniciados"

# 3. Esperar a que postgres esté listo
echo "Esperando a PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U admin -d digitalizacion >/dev/null 2>&1; then
        echo "  ✓ PostgreSQL listo"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "Error: PostgreSQL no responde después de 30 segundos"
        exit 1
    fi
    sleep 1
done

# 4. Restaurar BD
echo "Restaurando base de datos..."
# Limpiar conexiones existentes y dropear/crear BD limpia
docker-compose exec -T postgres psql -U admin -d postgres -c "DROP DATABASE IF EXISTS digitalizacion;" 2>/dev/null
docker-compose exec -T postgres psql -U admin -d postgres -c "CREATE DATABASE digitalizacion OWNER admin;" 2>/dev/null
# Restaurar
cat "$EXTRACT_DIR/db.sql" | docker-compose exec -T postgres psql -U admin digitalizacion
echo "  ✓ Base de datos restaurada"

# 5. Restaurar archivos MinIO
echo "Restaurando archivos de MinIO..."
docker run --rm \
    -v sistemadigitalizaciondearchivos_minio_data:/data \
    -v "$PROJECT_DIR/$EXTRACT_DIR":/backup \
    alpine:3.18 \
    tar xzf /backup/minio_data.tar.gz -C /data 2>/dev/null
echo "  ✓ Archivos de MinIO restaurados"

# 6. Reiniciar backend para que tome los cambios
echo "Reiniciando backend..."
docker-compose restart backend
echo "  ✓ Backend reiniciado"

# 7. Limpiar
rm -rf "$EXTRACT_DIR"
echo "  ✓ Archivos temporales eliminados"

echo ""
echo "============================================"
echo " Restauración completada"
echo "============================================"
