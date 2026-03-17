"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-17

"""
from typing import Sequence, Union
import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "clusters",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("api_url", sa.String(), nullable=False),
        sa.Column("api_token_id", sa.String(), nullable=False),
        sa.Column("api_token_secret", sa.String(), nullable=False),
        sa.Column("tls_verify", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sdn_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("ix_clusters_name", "clusters", ["name"])

    op.create_table(
        "flavors",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("cluster_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("vcpus", sa.Integer(), nullable=False),
        sa.Column("ram_mb", sa.Integer(), nullable=False),
        sa.Column("disk_gb", sa.Integer(), nullable=False),
        sa.Column("disk_bus", sa.String(), nullable=False, server_default="virtio"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_flavors_cluster_id", "flavors", ["cluster_id"])

    op.create_table(
        "networks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("cluster_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("bridge_name", sa.String(), nullable=False),
        sa.Column("vxlan_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_networks_cluster_id", "networks", ["cluster_id"])

    op.create_table(
        "vms",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("cluster_id", sa.String(), nullable=False),
        sa.Column("flavor_id", sa.String(), nullable=False),
        sa.Column("network_id", sa.String(), nullable=True),
        sa.Column("proxmox_vmid", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="provisioning"),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["cluster_id"], ["clusters.id"]),
        sa.ForeignKeyConstraint(["flavor_id"], ["flavors.id"]),
        sa.ForeignKeyConstraint(["network_id"], ["networks.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vms_user_id", "vms", ["user_id"])
    op.create_index("ix_vms_cluster_id", "vms", ["cluster_id"])
    op.create_index("ix_vms_flavor_id", "vms", ["flavor_id"])

    op.create_table(
        "jobs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("vm_id", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("log", sa.Text(), nullable=False, server_default=""),
        sa.Column("celery_task_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["vm_id"], ["vms.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])

    op.create_table(
        "system_configuration",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("default_cluster_id", sa.String(), nullable=True),
        sa.Column("vm_name_prefix", sa.String(), nullable=False, server_default="vm-"),
        sa.Column("max_vms_per_user", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("allow_self_registration", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["default_cluster_id"], ["clusters.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("system_configuration")
    op.drop_table("jobs")
    op.drop_table("vms")
    op.drop_table("networks")
    op.drop_table("flavors")
    op.drop_table("clusters")
    op.drop_table("users")
