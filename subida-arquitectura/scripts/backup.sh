#!/bin/bash
# Backup de la base de datos PostgreSQL.
#
# PostgreSQL NO corre en Docker: esta instalado de forma nativa en el host de
# Windows. Por eso este script usa el cliente `pg_dump` local en vez de
# `docker compose exec`.

set -euo pipefail

# Resolver rutas relativas a la ubicacion de este script, no al CWD actual.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCH_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ARCH_DIR/backups}"

# Leer una variable del .env sin ejecutarlo como codigo.
read_env() {
    local key="$1" file="$2" value
    [ -f "$file" ] || return 1
    value="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2- | sed -e 's/[[:space:]]*$//' -e 's/^["'"'"']//' -e 's/["'"'"']$//')"
    [ -n "$value" ] && printf '%s' "$value"
}

ENV_FILE="$ARCH_DIR/.env"
[ -f "$ENV_FILE" ] || ENV_FILE="$ARCH_DIR/.env.example"

echo "=== Backup de la base de datos ==="

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: no se encontro $ARCH_DIR/.env"
    exit 1
fi

DB_NAME="$(read_env POSTGRES_DB "$ENV_FILE" || true)"
DB_USER="$(read_env POSTGRES_USER "$ENV_FILE" || true)"
DB_PASS="$(read_env POSTGRES_PASSWORD "$ENV_FILE" || true)"
DB_PORT="$(read_env POSTGRES_PORT "$ENV_FILE" || true)"

DB_NAME="${DB_NAME:-digitalizacion}"
DB_USER="${DB_USER:-postgres}"
DB_PORT="${DB_PORT:-5432}"

# El .env usa host.docker.internal porque el backend corre DENTRO del contenedor.
# Desde el host ese nombre no resuelve, asi que el dump se hace contra el host local.
# Se usa 127.0.0.1 y no "localhost" a proposito: en Windows "localhost" resuelve a
# ::1 (IPv6) primero, y el pg_hba.conf tipico solo tiene regla de confianza para
# 127.0.0.1. Con ::1 se exigiria contrasena y el dump fallaria.
# Se puede sobreescribir con BACKUP_DB_HOST si tu configuracion es distinta.
DB_HOST="${BACKUP_DB_HOST:-127.0.0.1}"

# Localizar pg_dump: primero en el PATH, luego en las instalaciones nativas
# de PostgreSQL para Windows (pg_dump no viene en el PATH por defecto).
PG_DUMP="$(command -v pg_dump || true)"

if [ -z "$PG_DUMP" ]; then
    for candidate in /c/Program\ Files/PostgreSQL/*/bin/pg_dump.exe \
                     "/c/Program Files/PostgreSQL"/*/bin/pg_dump.exe; do
        [ -x "$candidate" ] && PG_DUMP="$candidate" && break
    done
fi

if [ -z "$PG_DUMP" ]; then
    echo "ERROR: no se encontro pg_dump."
    echo "       Instalalo con PostgreSQL o agregalo al PATH."
    exit 1
fi

echo "Configuracion:"
echo "  .env      : $ENV_FILE"
echo "  host      : $DB_HOST:$DB_PORT (nativo, fuera de Docker)"
echo "  base      : $DB_NAME  usuario: $DB_USER"
echo "  pg_dump   : $PG_DUMP"
echo

mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/backup_${STAMP}.sql"

# PGPASSWORD via entorno para no exponerla en la linea de comandos.
export PGPASSWORD="$DB_PASS"

echo "Volcando... (esto puede tardar si la base es grande)"
if ! "$PG_DUMP" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-password --format=plain --clean --if-exists > "$BACKUP_FILE"; then
    echo "ERROR: pg_dump fallo. Se elimina el dump incompleto."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Un dump de 0 bytes significa fallo silencioso: no comprimir ni conservar.
if [ ! -s "$BACKUP_FILE" ]; then
    echo "ERROR: el dump quedo vacio, se descarta."
    rm -f "$BACKUP_FILE"
    exit 1
fi

SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "  Volcado completo: $BACKUP_FILE ($SIZE)"

gzip -f "$BACKUP_FILE"
echo "  Comprimido: ${BACKUP_FILE}.gz"

# Conservar solo los 7 backups mas recientes.
find "$BACKUP_DIR" -name 'backup_*.sql.gz' -type f -mtime +7 -print -delete

echo "=== Backup completado en $BACKUP_DIR ==="
