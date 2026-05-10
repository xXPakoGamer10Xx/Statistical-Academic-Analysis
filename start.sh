#!/usr/bin/env bash
# ============================================================
#  Plataforma de Análisis Estadístico Académico
#  Script de instalación + arranque en PRODUCCIÓN
# ============================================================
set -euo pipefail

# Colores
GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${BLUE}[start]${NC} $*"; }
ok()   { echo -e "${GREEN}[ ok ]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
err()  { echo -e "${RED}[fail]${NC} $*" >&2; }

cd "$(dirname "$0")"

# ---------- 1. Verificaciones previas ----------
log "Verificando dependencias del sistema…"
command -v docker >/dev/null 2>&1 || { err "Docker no está instalado. https://docs.docker.com/get-docker/"; exit 1; }
docker compose version >/dev/null 2>&1 || { err "Docker Compose v2 no disponible."; exit 1; }
ok "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ---------- 2. Generar .env si no existe ----------
if [ ! -f .env ]; then
  log ".env no existe. Generando con secretos aleatorios…"
  cp .env.example .env

  rand() {
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -hex "$1"
    else
      LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c $(( $1 * 2 ))
    fi
  }

  JWT_SECRET_VAL=$(rand 32)
  POSTGRES_PASSWORD_VAL=$(rand 16)
  INITIAL_ADMIN_PASSWORD_VAL=$(rand 12)

  # macOS sed requiere -i ''
  if [[ "$OSTYPE" == "darwin"* ]]; then SED_INPLACE=(-i ""); else SED_INPLACE=(-i); fi

  sed "${SED_INPLACE[@]}" "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET_VAL}|" .env
  sed "${SED_INPLACE[@]}" "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${POSTGRES_PASSWORD_VAL}|" .env
  sed "${SED_INPLACE[@]}" "s|^INITIAL_ADMIN_PASSWORD=.*|INITIAL_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD_VAL}|" .env

  ok ".env generado. Credenciales del admin guardadas — léelas al final."
else
  ok ".env ya existe (no se sobreescribe)"
fi

# ---------- 3. Build + up ----------
log "Construyendo imágenes (esto puede tardar la primera vez)…"
docker compose --env-file .env build

log "Levantando servicios…"
docker compose --env-file .env up -d

# ---------- 4. Esperar a Postgres ----------
log "Esperando a que Postgres esté listo…"
for i in {1..40}; do
  if docker compose exec -T postgres pg_isready -U academia >/dev/null 2>&1; then
    ok "Postgres listo"
    break
  fi
  sleep 2
  if [ "$i" = "40" ]; then err "Postgres no respondió a tiempo"; exit 1; fi
done

# ---------- 5. Migraciones ----------
log "Ejecutando migraciones de base de datos…"
docker compose exec -T backend alembic upgrade head
ok "Migraciones aplicadas"

# ---------- 6. Crear admin inicial (idempotente) ----------
log "Verificando usuario administrador inicial…"
docker compose exec -T backend python -m scripts.create_admin
ok "Admin verificado"

# ---------- 7. Mostrar info ----------
ADMIN_EMAIL=$(grep '^INITIAL_ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^INITIAL_ADMIN_PASSWORD=' .env | cut -d= -f2-)
HTTP_PORT_VAL=$(grep '^HTTP_PORT=' .env | cut -d= -f2- || echo 80)

cat <<EOF

============================================================
${GREEN}✓ Sistema iniciado correctamente${NC}

  URL:        http://localhost:${HTTP_PORT_VAL:-80}
  Admin:      ${ADMIN_EMAIL}
  Contraseña: ${ADMIN_PASSWORD}

  Comandos útiles:
    docker compose logs -f backend     # ver logs
    docker compose ps                  # estado servicios
    docker compose down                # detener todo
    docker compose down -v             # detener + borrar datos

  ${YELLOW}IMPORTANTE:${NC} guarda la contraseña del admin en un lugar seguro
  y cámbiala desde el panel de gestión de usuarios.
============================================================
EOF
