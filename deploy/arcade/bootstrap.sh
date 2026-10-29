#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly APP_ROOT=/app
readonly DATA_ROOT=/data
readonly PGDATA=/data/postgres
readonly PGSOCKET=/run/postgresql
readonly PGPORT=55432
readonly ASSET_ROOT=/data/assets
readonly ASSET_ARCHIVE=/data/assets/Maplestory-Assets.zip
readonly ASSET_PASSWORD=/data/openms-db-password
readonly ADMIN_PASSWORD=/data/postgres-password
readonly EXTRACTION_MARKER=/data/extraction.complete
backend_pid=
frontend_pid=
worker_pid=
postgres_started=false

mkdir -p "$DATA_ROOT"
exec > >(tee -a "$DATA_ROOT/bootstrap.log") 2>&1

log() { printf '[bootstrap %s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

shutdown() {
  local exit_code=$?
  trap - EXIT TERM INT
  set +e
  for child in "$frontend_pid" "$backend_pid" "$worker_pid"; do
    if [[ -n "$child" ]]; then kill -TERM "$child" 2>/dev/null; fi
  done
  for child in "$frontend_pid" "$backend_pid" "$worker_pid"; do
    if [[ -n "$child" ]]; then wait "$child" 2>/dev/null; fi
  done
  if [[ "$postgres_started" == true ]]; then
    runuser -u postgres -- pg_ctl -D "$PGDATA" -m fast -w -t 20 stop
  fi
  log "Owned processes stopped; persistent data retained (exit $exit_code)"
  exit "$exit_code"
}
trap shutdown EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

as_app() {
  runuser -u openms -- "$@" &
  worker_pid=$!
  local result=0
  wait "$worker_pid" || result=$?
  worker_pid=
  return "$result"
}

persist_password() {
  local file=$1
  if [[ ! -s "$file" ]]; then
    openssl rand -hex 32 > "$file.tmp"
    chmod 0600 "$file.tmp"
    mv "$file.tmp" "$file"
  fi
  [[ $(cat "$file") =~ ^[a-f0-9]{64}$ ]] || fail "Invalid persisted password file: $file"
  chmod 0600 "$file"
}

prepare_storage() {
  mkdir -p "$ASSET_ROOT" /data/generated /data/cache "$PGSOCKET"
  chown openms:openms "$ASSET_ROOT" /data/generated /data/cache
  chmod 0755 /data "$ASSET_ROOT"
  chown postgres:postgres "$PGSOCKET"
  chmod 0700 "$PGSOCKET"
  for link in client/public/generated client/.cache; do
    if [[ -e "$APP_ROOT/$link" && ! -L "$APP_ROOT/$link" ]]; then
      rmdir "$APP_ROOT/$link" || fail "Refusing to replace nonempty $link"
    fi
  done
  ln -sfn /data/generated "$APP_ROOT/client/public/generated"
  ln -sfn /data/cache "$APP_ROOT/client/.cache"
}

start_postgres() {
  persist_password "$ADMIN_PASSWORD"
  persist_password "$ASSET_PASSWORD"
  if [[ ! -f "$PGDATA/PG_VERSION" ]]; then
    log 'Initializing persistent PostgreSQL cluster'
    install -d -m 0700 -o postgres -g postgres "$PGDATA"
    install -m 0600 -o postgres -g postgres "$ADMIN_PASSWORD" /run/postgresql/init-password
    runuser -u postgres -- initdb -D "$PGDATA" --username=postgres \
      --auth-local=peer --auth-host=scram-sha-256 --encoding=UTF8 \
      --locale=C.UTF-8 --pwfile=/run/postgresql/init-password
    rm /run/postgresql/init-password
  fi
  [[ $(cat "$PGDATA/PG_VERSION") == 18 ]] || fail 'PostgreSQL volume requires version 18'
  cat > "$PGDATA/postgresql.auto.conf" <<'PGCONF'
listen_addresses = '127.0.0.1'
port = 55432
unix_socket_directories = '/run/postgresql'
password_encryption = 'scram-sha-256'
max_connections = 40
shared_buffers = 32MB
work_mem = 4MB
PGCONF
  cat > "$PGDATA/pg_hba.conf" <<'PGHBA'
local all postgres peer
local all all reject
host openms openms 127.0.0.1/32 scram-sha-256
host all all 127.0.0.1/32 reject
PGHBA
  chown postgres:postgres "$PGDATA/postgresql.auto.conf" "$PGDATA/pg_hba.conf"
  runuser -u postgres -- pg_ctl -D "$PGDATA" -l "$PGDATA/server.log" -w -t 30 start
  postgres_started=true
}

prepare_database() {
  local password
  password=$(cat "$ASSET_PASSWORD")
  runuser -u postgres -- psql -h "$PGSOCKET" -p "$PGPORT" -d postgres \
    --set=ON_ERROR_STOP=1 --set="app_password=$password" <<'SQL'
SELECT 'CREATE ROLE openms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openms') \gexec
ALTER ROLE openms WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
SELECT 'CREATE DATABASE openms OWNER openms'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'openms') \gexec
REVOKE ALL ON DATABASE openms FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE openms TO openms;
SQL
  export DATABASE_URL="postgresql://openms:$password@127.0.0.1:$PGPORT/openms"
  log 'Applying explicit numbered OpenMS database migrations'
  as_app bun --smol tools/migrate.js --database-url "$DATABASE_URL"
}

prepare_assets() {
  local expected_sha url current_sha
  expected_sha=$(cat deploy/arcade/assets.sha256)
  url=$(cat deploy/arcade/assets.url)
  [[ "$expected_sha" =~ ^[a-f0-9]{64}$ ]] || fail 'A reviewed 64-character asset SHA-256 is required'
  [[ "$url" == https://* ]] || fail 'Asset archive URL must use HTTPS'
  current_sha=$(cat "$ASSET_ROOT/wz.complete" 2>/dev/null || true)
  if [[ "$current_sha" == "$expected_sha" && -s "$ASSET_ROOT/Maplestory-Client/Map.wz" ]]; then
    log 'Reusing verified original WZ archives'
    return
  fi
  if [[ ! -f "$ASSET_ARCHIVE" ]]; then
    log 'Downloading asset ZIP with resume enabled (1,765,661,358 bytes)'
    curl --fail --location --proto '=https' --proto-redir '=https' \
      --retry 5 --retry-delay 5 --retry-all-errors --connect-timeout 30 \
      --max-time 3600 --continue-at - --output "$ASSET_ARCHIVE.part" "$url" &
    worker_pid=$!
    wait "$worker_pid"
    worker_pid=
    printf '%s  %s\n' "$expected_sha" "$ASSET_ARCHIVE.part" | sha256sum --check --status
    mv "$ASSET_ARCHIVE.part" "$ASSET_ARCHIVE"
  else
    printf '%s  %s\n' "$expected_sha" "$ASSET_ARCHIVE" | sha256sum --check --status
  fi
  chmod 0644 "$ASSET_ARCHIVE"
  extract_wz "$expected_sha"
}

extract_wz() {
  local expected_sha=$1
  local -a members
  mapfile -t members < <(unzip -Z1 "$ASSET_ARCHIVE" | \
    awk -F/ 'NF == 2 && $1 == "Maplestory-Client" && $2 ~ /^[A-Za-z0-9]+\.wz$/ { print }')
  (( ${#members[@]} > 0 && ${#members[@]} <= 128 )) || fail 'Invalid top-level WZ inventory'
  log "Extracting ${#members[@]} top-level WZ files; executable and DLL files are excluded"
  as_app unzip -o "$ASSET_ARCHIVE" "${members[@]}" -d "$ASSET_ROOT"
  [[ -s "$ASSET_ROOT/Maplestory-Client/Map.wz" ]] || fail 'Map.wz is absent from the verified archive'
  printf '%s\n' "$expected_sha" > "$ASSET_ROOT/wz.complete.tmp"
  mv "$ASSET_ROOT/wz.complete.tmp" "$ASSET_ROOT/wz.complete"
}

prepare_extraction() {
  local source_sha identity previous
  source_sha=$(find client/src client/tools shared content/src infra -type f -print0 | \
    sort -z | xargs -0 sha256sum | sha256sum | cut -d ' ' -f 1)
  identity="$(cat deploy/arcade/assets.sha256):$source_sha"
  previous=$(cat "$EXTRACTION_MARKER" 2>/dev/null || true)
  if [[ "$previous" == "$identity" && -s /data/generated/catalog.json ]]; then
    log 'Reusing completed extraction with matching original-asset and recipe identity'
    return
  fi
  log 'Extracting browser assets; 16 GB RAM is recommended for first-bootstrap headroom'
  as_app bun --smol client/tools/extract.js \
    --assets /data/assets/Maplestory-Client --preflight-report /data/cache/preflight.json
  [[ -s /data/generated/catalog.json ]] || fail 'Extraction finished without a catalog'
  printf '%s\n' "$identity" > "$EXTRACTION_MARKER.tmp"
  mv "$EXTRACTION_MARKER.tmp" "$EXTRACTION_MARKER"
}

start_game() {
  unset OPENMS_STUDIO_ORIGIN OPENMS_DEV_PASSWORD OPENMS_MODE
  export NODE_ENV=production OPENMS_HOST=127.0.0.1 OPENMS_PORT=3200
  export OPENMS_ORIGIN=https://openms-arcade.fly.dev
  export OPENMS_SERVER_URL=http://127.0.0.1:3200 ONLINE_HOST=0.0.0.0 ONLINE_PORT=8080
  log 'Starting production authority on loopback:3200 and browser proxy on :8080'
  runuser -u openms -- bun --smol server/src/index.js &
  backend_pid=$!
  runuser -u openms -- bun --smol client/tools/prod-online.js &
  frontend_pid=$!
  local result=0
  wait -n "$backend_pid" "$frontend_pid" || result=$?
  log "A game process exited (status $result); stopping this instance"
  if [[ "$result" == 0 ]]; then result=1; fi
  return "$result"
}

cd "$APP_ROOT"
prepare_storage
start_postgres
prepare_database
prepare_assets
prepare_extraction
start_game
