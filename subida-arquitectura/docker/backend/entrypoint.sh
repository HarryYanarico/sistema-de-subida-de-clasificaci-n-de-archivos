#!/bin/bash
set -e

echo "Esperando a que PostgreSQL este listo..."
while ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB; do
  sleep 1
done

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

echo "Iniciando servidor..."
exec "$@"
