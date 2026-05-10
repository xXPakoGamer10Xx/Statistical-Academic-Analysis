from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "academia_stats",
    broker=settings.redis_url_str,
    backend=settings.redis_url_str,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Mexico_City",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=60 * 30,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
)
