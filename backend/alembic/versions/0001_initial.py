"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-01

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subsistemas",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column("nombre", sa.String(100), nullable=False, unique=True),
        sa.Column("codigo", sa.String(50), nullable=False, unique=True),
        sa.Column("descripcion", sa.String(255), nullable=True),
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="usuario"),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "matricula",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("ciclo_escolar", sa.String(20), nullable=False, index=True),
        sa.Column("cuatrimestre", sa.Integer(), nullable=False),
        sa.Column("programa_educativo", sa.String(150), nullable=False, index=True),
        sa.Column("total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("nuevo_ingreso", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bajas_reprobacion", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bajas_desercion", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hombres", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mujeres", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("poblacion_edad_escolar", sa.Integer(), nullable=True),
        sa.Column("egresados_nms", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "subsistema_id",
            "ciclo_escolar",
            "cuatrimestre",
            "programa_educativo",
            name="uq_matricula_periodo",
        ),
    )

    op.create_table(
        "evaluacion_academica",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("ciclo_escolar", sa.String(20), nullable=False, index=True),
        sa.Column("cuatrimestre", sa.Integer(), nullable=False),
        sa.Column("programa_educativo", sa.String(150), nullable=False),
        sa.Column("promedio_pe", sa.Numeric(5, 2), nullable=False),
        sa.Column("num_pe", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "evaluacion_docente",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("ciclo_escolar", sa.String(20), nullable=False, index=True),
        sa.Column("docente_id", sa.String(50), nullable=False, index=True),
        sa.Column("docente_nombre", sa.String(150), nullable=False),
        sa.Column("programa_educativo", sa.String(150), nullable=False),
        sa.Column("evaluador_tipo", sa.String(20), nullable=False),
        sa.Column("puntaje", sa.Numeric(4, 2), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "titulacion",
        sa.Column("id", sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("generacion", sa.String(20), nullable=False, index=True),
        sa.Column("programa_educativo", sa.String(150), nullable=False),
        sa.Column("matricula_generacional", sa.Integer(), nullable=False),
        sa.Column("concluyeron_estudios", sa.Integer(), nullable=False),
        sa.Column("egresados", sa.Integer(), nullable=False),
        sa.Column("titulados", sa.Integer(), nullable=False),
        sa.Column("ingresados_ns", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "subsistema_id", "generacion", "programa_educativo", name="uq_titulacion_generacion"
        ),
    )

    op.create_table(
        "upload_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "subsistema_id",
            sa.Integer(),
            sa.ForeignKey("subsistemas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dataset_type", sa.String(50), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("rows_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rows_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors", postgresql.JSONB(), nullable=True),
        sa.Column("error_message", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("upload_jobs")
    op.drop_table("titulacion")
    op.drop_table("evaluacion_docente")
    op.drop_table("evaluacion_academica")
    op.drop_table("matricula")
    op.drop_table("users")
    op.drop_table("subsistemas")
