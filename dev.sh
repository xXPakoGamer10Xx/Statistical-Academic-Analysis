#!/usr/bin/env bash
# ============================================================
#  Plataforma de Análisis Estadístico Académico
#  Script de DESARROLLO con hot-reload
# ============================================================
set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${BLUE}[dev]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}  $*"; }

cd "$(dirname "$0")"

COMPOSE="docker compose -f docker-compose.dev.yml"

case "${1:-up}" in
  up|"")
    log "Levantando entorno de desarrollo (hot-reload activo)…"
    $COMPOSE up -d --build

    log "Esperando a Postgres…"
    for _ in {1..30}; do
      $COMPOSE exec -T postgres pg_isready -U academia >/dev/null 2>&1 && break
      sleep 1
    done

    log "Aplicando migraciones…"
    $COMPOSE exec -T backend alembic upgrade head || true

    log "Creando admin de desarrollo…"
    $COMPOSE exec -T backend python -m scripts.create_admin || true

    cat <<EOF
${GREEN}✓ Entorno de desarrollo listo${NC}

  Frontend (Vite):  http://localhost:5173
  Backend (API):    http://localhost:8000/api/docs
  Postgres:         localhost:5432  (academia / academia_dev)
  Redis:            localhost:6379

  Admin de prueba:  admin@universidad.edu / admin12345

  Hot-reload:
    - editar archivos en backend/app o frontend/src se refleja al instante
    - Celery requiere reinicio del contenedor worker tras cambios

  Comandos:
    ./dev.sh logs          # logs combinados
    ./dev.sh logs backend  # solo backend
    ./dev.sh seed          # cargar datos de ejemplo
    ./dev.sh shell         # shell en contenedor backend
    ./dev.sh down          # detener
    ./dev.sh rebuild       # reconstruir imágenes
EOF
    ;;
  logs)
    shift || true
    $COMPOSE logs -f --tail=100 "$@"
    ;;
  shell)
    $COMPOSE exec backend bash
    ;;
  seed)
    log "Cargando datos de ejemplo…"
    if [ -f scripts/seed_demo.py ]; then
      $COMPOSE exec -T backend python -m scripts.seed_demo
    else
      echo -e "${YELLOW}No existe scripts/seed_demo.py — sube CSVs reales desde el panel de Cargas${NC}"
    fi
    ;;
  down)
    $COMPOSE down
    ;;
  rebuild)
    $COMPOSE down
    $COMPOSE build --no-cache
    $COMPOSE up -d
    ;;
  reset)
    log "Reseteando volúmenes (datos se perderán)…"
    $COMPOSE down -v
    $COMPOSE up -d --build
    ;;
  *)
    echo "Uso: $0 [up|logs|shell|seed|down|rebuild|reset]"
    exit 1
    ;;
esac
