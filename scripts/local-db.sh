#!/usr/bin/env bash
# Lokale PostgreSQL-Instanz für Datenbank- und RLS-Tests (ohne Docker).
# Nutzung: npm run db:local -- start|stop|status
set -euo pipefail

if [ -z "${PGBIN:-}" ]; then
  PGBIN="$( (ls -d /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin 2>/dev/null || true) | sort -V | tail -1)"
fi
if [ -z "$PGBIN" ] && command -v pg_ctl >/dev/null 2>&1; then
  PGBIN="$(dirname "$(command -v pg_ctl)")"
fi
DATA_DIR="${LOCAL_DB_DIR:-/tmp/immovia-pg}"
PORT="${LOCAL_DB_PORT:-54329}"
CMD="${1:-start}"

run_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

case "$CMD" in
  start)
    if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
      mkdir -p "$DATA_DIR"
      if [ "$(id -u)" = "0" ]; then chown postgres "$DATA_DIR"; fi
      run_pg "$PGBIN/initdb" -D "$DATA_DIR" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
    fi
    if run_pg "$PGBIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
      echo "PostgreSQL läuft bereits auf Port $PORT"
    else
      run_pg "$PGBIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k /tmp" -l "$DATA_DIR/server.log" -w start >/dev/null
      echo "PostgreSQL gestartet auf Port $PORT (Daten: $DATA_DIR)"
    fi
    ;;
  stop)
    run_pg "$PGBIN/pg_ctl" -D "$DATA_DIR" -w stop
    ;;
  status)
    run_pg "$PGBIN/pg_ctl" -D "$DATA_DIR" status
    ;;
  *)
    echo "Unbekannter Befehl: $CMD (start|stop|status)" >&2
    exit 1
    ;;
esac
