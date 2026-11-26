#!/usr/bin/env bash
# Ensayo "como producción": base `prodlike` = stub de Supabase + esquema del repo + capa de producción reconstruida
# (prod_baseline/10_prod_layer.sql) + la cadena de migraciones NUEVAS (desde 20261124000000), tal como se aplicaría allá.
# Solo base local. Uso: bash docker/local-db/rehearsal.sh
set -euo pipefail
C=avances-local-db
DB=prodlike
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../supabase/migrations"
run() { docker exec -i "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f - < "$1" 2>&1 | grep -v "NOTICE\|set_config\|^-\|^ *$\|(1 row)" || true; }

docker exec "$C" psql -U postgres -d postgres -q -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" >/dev/null
echo "== stub";            run "$here/bootstrap/00_supabase_stub.sql"
echo "== esquema (ya en producción: clonacion_esquema)"; run "$mig/20261019150000_esquema.sql"
echo "== wtgm_file (ya en producción)";                  run "$mig/20261024120000_wtgm_file.sql"
echo "== capa de producción";  run "$here/prod_baseline/10_prod_layer.sql"
for f in $(ls "$mig"/2026112*.sql | sort); do
  echo "== cadena nueva: $(basename "$f")"
  run "$f"
done
echo "== listo"
