# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PSSCP (Proxmox Self-Service Cloud Portal) is a web-based control plane that wraps one or more Proxmox VE clusters behind a cloud-like self-service interface (think AWS/Azure UX, but backed by Proxmox). This repository is currently in the **specification phase** — the README defines the vision and architecture, but implementation has not started yet.

## Planned Architecture

```
User (Browser)
    ↓
Frontend (React)
    ↓
Backend API
    ↓
Worker Queue (Redis)
    ↓
Proxmox Driver Layer
    ↓
Proxmox API
```

**Deployment stack:** Docker + Docker Compose with these services:
- `api` — Backend API service
- `frontend` — React web UI
- `postgres` — Primary database
- `redis` — Job queue
- `worker` — Async job processor
- `prometheus` + `grafana` — Optional observability

## Key Design Decisions

- **All Proxmox interaction goes through the Driver Layer** — no service communicates directly with Proxmox nodes except through this abstraction. This is what enables multi-cluster support.
- **Async job model** — VM provisioning and other long-running operations are dispatched via Redis queue and processed by the worker service. Jobs are tracked in the database with real-time progress visible in the UI.
- **No config files post-deployment** — all cluster connections, flavors, templates, and feature toggles are managed through the web UI and stored in PostgreSQL.
- **Proxmox API tokens only** — the system never stores Proxmox user passwords; only API tokens with scoped permissions.
- **SDN is opt-in** — the system detects whether a cluster supports SDN and exposes advanced networking only when available.

## Data Model (Core Entities)

`Users` → `VMs` (owned by user, provisioned on a cluster)
`Clusters` → `Flavors` (CPU/RAM/disk presets), `Networks` (standard bridge or SDN VXLAN)
`Jobs` — tracks async operations (create VM, delete VM, etc.) with audit trail
`SystemConfiguration` — global settings managed via UI

## Security Model

- JWT authentication
- Two roles: `Admin` (full access) and `User` (self-service only)
- Audit log on all actions
- Users never see Proxmox internals

## Quick Start (once implemented)

```bash
docker-compose up -d
```

Then open the web UI and complete the setup wizard: create admin account → add Proxmox cluster (API URL + token) → select default template → define a flavor.

## v0.1 Scope Limitations

Out of scope for the initial version: billing/cost tracking, auto-scaling, BGP/EVPN SDN, Terraform integration.
