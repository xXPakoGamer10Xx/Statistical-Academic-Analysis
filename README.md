# Plataforma de Análisis Estadístico Académico

Sistema web para la Dirección Académica que ingiere CSVs históricos de la institución, calcula los indicadores oficiales (Matrícula, Aprovechamiento, Reprobación, Deserción, Eficiencia Terminal, Titulación, y opcionales) y los presenta como dashboards interactivos por subsistema.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | FastAPI 0.115 · Python 3.12 · SQLAlchemy 2 async · Pandas · Celery |
| Frontend | React 18 · TypeScript · Vite · Tailwind · ECharts · TanStack Query |
| Base de datos | PostgreSQL 16 |
| Cache / Cola | Redis 7 |
| Servidor web | Nginx |
| Orquestación | Docker Compose |

## Requisitos

- Docker 24+ y Docker Compose v2
- 4 GB RAM disponibles (recomendado 8 GB)
- Puerto 80 (producción) o 5173+8000 (desarrollo) libres

## Instalación rápida (PRODUCCIÓN)

```bash
./start.sh
```

El script:
1. Verifica que Docker esté instalado.
2. Genera `.env` con secretos aleatorios (solo la primera vez).
3. Construye las imágenes y arranca los servicios.
4. Aplica migraciones y crea el usuario admin inicial.
5. Imprime la URL de acceso y las credenciales generadas.

Acceso por defecto: **http://localhost** · usuario y contraseña impresos al final.

### Comandos útiles en producción

```bash
docker compose ps                   # estado de los servicios
docker compose logs -f backend      # logs en vivo
docker compose down                 # detener (datos persisten)
docker compose down -v              # detener y borrar datos
docker compose up -d --build        # reconstruir tras cambios
docker compose --profile worker up -d --scale worker=4   # escalar workers
```

## Desarrollo local

```bash
./dev.sh           # levantar con hot-reload
./dev.sh logs      # ver logs
./dev.sh shell     # bash dentro del contenedor backend
./dev.sh down      # detener
./dev.sh reset     # detener y borrar volúmenes
```

Endpoints de desarrollo:
- Frontend (Vite): http://localhost:5173
- Backend (API + docs): http://localhost:8000/api/docs
- Admin de prueba: `admin@universidad.edu` / `admin12345`

Hot-reload activo en `backend/app/**` y `frontend/src/**`.

## Arquitectura

```
Nginx (80) ─┬─► /        → React SPA (build estático)
            └─► /api/*   → FastAPI (uvicorn workers)
                          ├─► PostgreSQL  (datos)
                          └─► Redis  ◄────► Celery workers (procesado CSV)
```

- **Multi-tenant por subsistema**: 7 subsistemas (Tecnológicos de Estudios Superiores, Estatales, Interculturales, Tecnológicas, Politécnicas, Normales, Particulares) con aislamiento por `subsistema_id`.
- **Carga CSV asíncrona**: el endpoint encola un job en Celery; el frontend hace polling cada 3s.
- **JWT con refresh**: access (15 min) + refresh (7 días).

## Mapeo Requisitos → Implementación

| RF | Implementación |
|----|----------------|
| 01 Auth + control acceso | `/api/v1/auth/login` + JWT + RBAC (`admin` / `usuario`) |
| 02 Gestión de cuentas | `/api/v1/users` (solo admin) |
| 03 Carga CSV | `/api/v1/uploads` → Celery → validación Pandas |
| 04 Matrícula | `/api/v1/matricula` + `pages/Matricula.tsx` |
| 05 Rendimiento académico | `/api/v1/rendimiento` + `pages/Rendimiento.tsx` |
| 06 Eficiencia terminal y titulación | `/api/v1/eficiencia` (máx. 3 generaciones) |
| 07 Evaluación docente | `/api/v1/docentes` (alumnos vs directivos) |
| 08 Filtrado dinámico | `components/filters/FilterBar` + Zustand |
| 09 Exportar reportes | `/api/v1/reports/pdf` (WeasyPrint) |

## Formato esperado de los CSV

| Dataset | Columnas requeridas |
|---------|---------------------|
| `matricula` | `ciclo_escolar, cuatrimestre, programa_educativo, total, nuevo_ingreso, bajas_reprobacion, bajas_desercion, hombres, mujeres` (opcional: `poblacion_edad_escolar, egresados_nms`) |
| `evaluacion_academica` | `ciclo_escolar, cuatrimestre, programa_educativo, promedio_pe, num_pe` |
| `titulacion` | `generacion, programa_educativo, matricula_generacional, concluyeron_estudios, egresados, titulados` |
| `evaluacion_docente` | `ciclo_escolar, docente_id, docente_nombre, programa_educativo, evaluador_tipo, puntaje` (`evaluador_tipo` ∈ {alumno, directivo}) |

Filas con errores se reportan al final del job sin abortar la carga completa.

## Estructura

```
.
├── backend/         FastAPI + workers Celery + Alembic
├── frontend/        React + TypeScript + Vite + ECharts
├── nginx/           configs adicionales
├── postgres-init/   scripts SQL de bootstrap
├── docker-compose.yml          (producción)
├── docker-compose.dev.yml      (desarrollo, hot-reload)
├── start.sh         instalación + arranque producción
├── dev.sh           desarrollo
└── .env.example     plantilla de variables
```

## Tests

```bash
# Backend
docker compose -f docker-compose.dev.yml exec backend pytest

# Frontend
cd frontend && npm run test
```

## Seguridad

- Contraseñas con Argon2 (passlib).
- JWT con secreto generado aleatoriamente (32 bytes hex).
- Rate-limit 120 req/min por IP (configurable).
- CORS estricto por lista blanca.
- Pydantic valida todos los inputs.
