# Proxmox Self-Service Cloud Portal (PSSCP)

A portable, web-based control plane that transforms one or more Proxmox VE clusters into a simple, cloud-like platform.

---

## Overview

PSSCP provides a **self-service interface** for provisioning and managing virtual machines on Proxmox, with an experience similar to AWS or Azure — without exposing users to Proxmox internals.

### Key Characteristics

- 100% **web-based** (no CLI or config files after deployment)
- **Portable** across any Proxmox cluster
- **Multi-cluster support**
- Predefined **resource flavors**
- Optional **advanced networking (SDN)**
- Built-in **monitoring and observability**

---

## Core Principles

- **UI-Only Operation** — All configuration and actions are performed through the web interface.
- **Portability First** — Works with any Proxmox cluster with admin API access.
- **Abstraction Over Exposure** — Users interact with simple concepts, not infrastructure details.
- **Optional Complexity** — Advanced features like SDN are opt-in and auto-detected.
- **Observability by Default** — Monitoring is built-in and available out of the box.

---

## Architecture

```
User (Browser)
    ↓
Frontend (React SPA, served by nginx)
    ↓
Backend API (FastAPI)
    ↓
Worker Queue (Celery + Redis)
    ↓
Proxmox Driver Layer (Python module)
    ↓
Proxmox API
```

**Frontend** is a React single-page application. It authenticates via JWT and polls job progress in real time while long-running operations execute.

**Backend API** is a thin FastAPI layer. It validates requests, checks authorisation, and enqueues work. It never calls Proxmox directly.

**Worker Queue** (Celery + Redis) processes all Proxmox-mutating operations asynchronously. Workers report incremental progress back to the database so the UI can display live status.

**Proxmox Driver Layer** is a Python module (not a separate service) that is the sole entry point to the Proxmox API. All cluster communication is abstracted here, enabling multi-cluster support and clean separation of concerns.

**PostgreSQL** is the system of record — users, clusters, VMs, jobs, and configuration all live here.

For detailed component descriptions, entity schemas, and design decisions, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Features

### Self-Service Provisioning
- Create and manage VMs from a simple UI
- No direct access to Proxmox required

### Flavors (Instance Types)
- Predefined CPU, RAM, and disk configurations
- Consistent deployments across clusters

### Multi-Cluster Support
- Connect and manage multiple Proxmox clusters
- Dynamic capability detection per cluster

### Optional SDN Networking
- Standard bridge-based networking (default, always available)
- Advanced VXLAN networking via Proxmox SDN (opt-in, auto-detected per cluster)

### Monitoring & Dashboards
- Cluster resource usage (CPU, RAM, storage)
- Per-user VM counts and consumption
- Optional Prometheus scraping and embedded Grafana dashboards

### Activity Tracking
- Real-time job progress with live log output
- Full audit trail of all actions

---

## Deployment

### Requirements

- 1 Linux host for the management plane (Docker + Docker Compose)
- 1 or more Proxmox VE nodes reachable from the management host
- A Proxmox API token with the permissions listed below

### Stack Components

| Service | Purpose |
|---|---|
| `api` | FastAPI backend |
| `frontend` | React UI (nginx) |
| `postgres` | Primary database |
| `redis` | Celery broker and result backend |
| `worker` | Celery worker |
| `prometheus` | Metrics scraping (optional) |
| `grafana` | Dashboards (optional) |

### Quick Start

```bash
docker-compose up -d
```

Then open the web UI at `http://<host>` and follow the setup wizard.

---

## Environment Variables

Copy `.env.example` to `.env` before starting. The following variables are required:

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing secret (generate with `openssl rand -hex 32`) | `abc123...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://psscp:pass@postgres/psscp` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379/0` |
| `ENCRYPTION_KEY` | Key for encrypting Proxmox API token secrets at rest | `base64-encoded-32-byte-key` |

Optional variables:

| Variable | Description | Default |
|---|---|---|
| `LOG_LEVEL` | Application log level | `info` |
| `PROMETHEUS_ENABLED` | Enable `/metrics` endpoint | `false` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173` |

---

## Proxmox API Token Permissions

PSSCP uses Proxmox API tokens exclusively — it never stores user passwords.

Create a dedicated token in Proxmox with the following minimum privileges:

| Privilege | Scope | Required for |
|---|---|---|
| `VM.Audit` | `/vms` | Reading VM state and templates |
| `VM.Allocate` | `/vms` | Creating and deleting VMs |
| `VM.Config.*` | `/vms` | Configuring VM hardware |
| `VM.PowerMgmt` | `/vms` | Starting, stopping, rebooting |
| `VM.Clone` | `/vms` | Cloning templates |
| `SDN.Use` | `/sdn` | Attaching VMs to SDN networks (optional) |
| `SDN.Allocate` | `/sdn` | Creating SDN zones and VNets (optional) |

Add the cluster in the PSSCP UI with the API URL, token ID (e.g. `user@pam!mytoken`), and token secret.

---

## First-Time Setup

After `docker-compose up -d`, the web UI presents a guided setup wizard:

1. **Create admin account** — set email and password for the first admin user.
2. **Add a Proxmox cluster** — enter the API URL, token ID, and token secret. PSSCP will test connectivity and auto-detect SDN support.
3. **Select a default template** — choose the VM template to use for provisioning.
4. **Define a flavor** — create at least one CPU/RAM/disk preset.

Once complete, users can begin provisioning VMs immediately. SDN networking options appear automatically if the cluster supports it.

---

## Data Model

- **Users** — authenticate via JWT; either `admin` (full access) or `user` (self-service only).
- **Clusters** — registered Proxmox clusters, each with its own API token. SDN capability is auto-detected on registration.
- **Flavors** — CPU/RAM/disk presets scoped to a cluster. Users select a flavor when creating a VM.
- **Networks** — bridge-based or VXLAN networks available for VM attachment.
- **VMs** — owned by a user, provisioned on a cluster. Lifecycle: `provisioning → running → stopped → deleted`.
- **Jobs** — every Proxmox-mutating operation creates a Job record. State machine: `pending → running → success | failed`. Jobs carry a live progress percentage and append-only log. The UI polls `GET /jobs/{id}` every 2 seconds until the job reaches a terminal state.
- **SystemConfiguration** — global operator settings (default cluster, VM name prefix, per-user limits, feature flags) managed entirely through the admin UI.

For full entity schemas, see [ARCHITECTURE.md § Data Model](ARCHITECTURE.md#data-model).

---

## Security

- JWT-based authentication (short-lived access tokens + httpOnly refresh token cookies)
- Two roles: `Admin` (full access) and `User` (self-service only)
- Proxmox API tokens only — user passwords are never stored
- Proxmox token secrets are encrypted at rest
- UUID primary keys prevent resource enumeration
- Audit log on all mutating actions
- Users never see Proxmox internals or other users' resources

---

## Limitations (v0.1)

- No billing or cost tracking
- No auto-scaling
- Limited SDN features (no BGP/EVPN)
- No Terraform integration

---

## Success Criteria

- Works with any Proxmox cluster
- Fully operable from the web UI — no CLI required after deployment
- Simple onboarding (< 5 minutes)
- Reliable VM provisioning with real-time progress feedback

---

## Further Reading

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Component breakdown, entity schemas, job lifecycle, auth flow, ADRs |
| [API_SPEC.md](API_SPEC.md) | Full HTTP API reference, request/response shapes, error format |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Dev setup, test commands, code conventions, migration workflow |
