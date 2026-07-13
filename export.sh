#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="export_${TIMESTAMP}"
ARCHIVE="${EXPORT_DIR}.tar.gz"

echo "============================================"
echo " Exportando Sistema de Digitalización"
echo "============================================"

# 1. Verificar contenedores
if ! docker-compose ps postgres --format '{{.State}}' 2>/dev/null | grep -q "running"; then
    echo "Error: El contenedor 'postgres' no está corriendo. Ejecuta 'docker-compose up -d postgres' primero."
    exit 1
fi

# 2. Crear directorio temporal
mkdir -p "$EXPORT_DIR"
echo "Directorio temporal: $EXPORT_DIR/"

# 3. Exportar BD
echo "Exportando base de datos..."
docker-compose exec -T postgres pg_dump -U admin digitalizacion > "$EXPORT_DIR/db.sql"
echo "  ✓ db.sql ($(wc -c < "$EXPORT_DIR/db.sql") bytes)"

# 4. Exportar archivos MinIO
echo "Exportando archivos de MinIO..."
docker run --rm \
    -v sistemadigitalizaciondearchivos_minio_data:/data \
    -v "$PROJECT_DIR/$EXPORT_DIR":/backup \
    alpine:3.18 \
    tar czf /backup/minio_data.tar.gz -C /data . 2>/dev/null
echo "  ✓ minio_data.tar.gz"

# 5. Copiar configuración
cp docker-compose.yml "$EXPORT_DIR/"
echo "  ✓ docker-compose.yml"

# 6. Empaquetar todo
echo "Comprimiendo exportación..."
tar czf "$ARCHIVE" -C "$PROJECT_DIR" "$EXPORT_DIR"
rm -rf "$EXPORT_DIR"

echo ""
echo "============================================"
echo " Exportación completada:"
echo "   $ARCHIVE"
echo "   Tamaño: $(du -h "$ARCHIVE" | cut -f1)"
echo "============================================"
