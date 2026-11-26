#!/usr/bin/env bash
# Carga en la base LOCAL (contenedor avances-local-db): stub de Supabase, migraciones en orden y seeds.
# Uso: bash docker/local-db/apply.sh
set -euo pipefail
C=avances-local-db
psqlx() { docker exec -i "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== stub de Supabase"
psqlx -f /work/bootstrap/00_supabase_stub.sql

for f in $(docker exec "$C" sh -c 'ls /work/migrations/*.sql' | sort); do
  echo "== migración $(basename "$f")"
  psqlx -f "$f"
done

for f in $(docker exec "$C" sh -c 'ls /work/seeds/*.sql' | sort); do
  echo "== seed $(basename "$f")"
  psqlx -f "$f"
done
echo "== listo"
