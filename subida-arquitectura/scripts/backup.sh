#!/bin/bash
# Script de backup de la base de datos

set -e

BACKUP_DIR="../backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$DATE.sql"

echo "=== Creando backup de la base de datos ==="

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# Crear backup
docker-compose exec -T postgres pg_dump -U postgres digitalizacion > "$BACKUP_FILE"

echo "Backup creado en: $BACKUP_FILE"

# Comprimir
gzip "$BACKUP_FILE"
echo "Backup comprimido: ${BACKUP_FILE}.gz"

# Eliminar backups antiguos (mantener ultimos 7)
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +7 -delete

echo "=== Backup completado ==="
