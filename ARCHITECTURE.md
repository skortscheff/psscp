# Architecture

This document describes the internal design of PSSCP. For a high-level overview and the architecture diagram, see [README.md](README.md).

---

## System Overview

PSSCP is a five-layer system: a React SPA talks to a FastAPI backend, which enqueues long-running operations into a Celery/Redis queue. Workers consume those jobs and communicate with Proxmox clusters exclusively through an internal Driver Layer. PostgreSQL is the system of record for all state.

No service other than the Driver Layer ever calls the Proxmox API.

---

## Component Breakdown

### Frontend (React)

A single-page application served by nginx. It authenticates via JWT and communicates with the backend over a versioned REST API (`/api/v1/...`).

For long-running operations (VM creation, deletion, cluster registration) the frontend receives a `202 Accepted` response containing a `job_id`. It then polls `GET /jobs/{id}` every 2 seconds until `status` is no longer `running`. Progress percentage and incremental log lines are rendered in real time.

### Backend API (FastAPI)

A thin HTTP layer. Its responsibilities are limited to:

1. Authenticating and authorising the request (JWT + role check)
2. Validating the request body (Pydantic v2 models)
3. Writing the initial record to the database
4. Enqueuing a Celery task
5. Returning `202 Accepted` with the job ID

The API **never** calls the Proxmox API directly. All Proxmox-mutating operations are delegated to workers.

### Worker (Celery + Redis)

Workers execute all Proxmox-mutating operations asynchronously. Each task:

- Updates `Job.status` to `running` on start
- Writes incremental progress to `Job.progress` (0–100) and appends to `Job.log`
- Updates `Job.status` to `success` or `failed` on completion

**Retry policy:** exponential backoff, maximum 3 retries. Transient Proxmox API errors (e.g. network timeouts) trigger a retry; logical errors (e.g. invalid template ID) fail immediately.

### Proxmox Driver Layer

A Python module (not a separate service) imported directly by worker tasks. It is the **only** code in the system that calls the Proxmox API.

Key classes:

| Class | Responsibility |
|---|---|
| `ProxmoxClient` | Manages a connection to a single cluster using the API token stored in the DB record. Wraps `proxmoxer`. |
| `VMProvisioner` | Creates, clones, starts, stops, and deletes VMs. |
| `TemplateRegistry` | Discovers and caches available templates on a cluster. |
| `SDNManager` | Detects SDN capability; creates and deletes VXLAN zones and VNets. |

Credentials (API token ID + secret) are loaded from the database per operation. They are never read from environment variables or config files.

**Why `proxmoxer` over raw HTTP:** reduces boilerplate, handles TLS verification flag consistently, and provides a Pythonic interface to the Proxmox REST tree. See [Key Design Decisions](#key-design-decisions).

### PostgreSQL

The system of record. Holds users, clusters, flavors, VMs, networks, jobs, and system configuration. All schema changes are managed through Alembic migrations.

### Redis

Serves dual purpose: Celery broker (task queue) and Celery result backend (task state). It does **not** store application state — PostgreSQL is authoritative.

### Prometheus + Grafana (Optional)

Prometheus scrapes a `/metrics` endpoint exposed by the API service. Pre-built Grafana dashboards cover cluster resource utilisation, per-user VM counts, and job throughput. Both services are defined in the Compose file but can be omitted for minimal deployments.

---

## Data Model

### Entity Relationship Summary

```
Users ──< VMs >── Clusters ──< Flavors
                     │
                     └──< Networks
Jobs >── Users
Jobs >── VMs (nullable)
SystemConfiguration (singleton)
```

### Entity Definitions

**`users`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| email | text | unique |
| hashed_password | text | bcrypt |
| role | enum | `admin` \| `user` |
| is_active | boolean | |
| created_at | timestamptz | |

**`clusters`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | text | unique |
| api_url | text | |
| api_token_id | text | e.g. `user@pam!mytoken` |
| api_token_secret | text | encrypted at rest |
| tls_verify | boolean | default true |
| sdn_enabled | boolean | auto-detected on registration |
| is_active | boolean | |

**`flavors`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| cluster_id | UUID FK → clusters | |
| name | text | unique per cluster |
| vcpus | integer | |
| ram_mb | integer | |
| disk_gb | integer | |
| disk_bus | enum | `virtio` \| `scsi` \| `ide` |
| is_active | boolean | |

**`vms`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | owner |
| cluster_id | UUID FK → clusters | |
| flavor_id | UUID FK → flavors | snapshot at creation |
| network_id | UUID FK → networks | nullable |
| proxmox_vmid | integer | Proxmox-assigned VMID |
| name | text | |
| status | enum | `provisioning` \| `running` \| `stopped` \| `error` \| `deleted` |
| ip_address | text | nullable; populated post-provision |
| created_at | timestamptz | |

**`networks`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| cluster_id | UUID FK → clusters | |
| name | text | |
| type | enum | `bridge` \| `vxlan` |
| bridge_name | text | e.g. `vmbr0` |
| vxlan_id | integer | nullable; SDN only |

**`jobs`**

| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users | who triggered it |
| vm_id | UUID FK → vms | nullable |
| type | enum | `create_vm` \| `delete_vm` \| `start_vm` \| `stop_vm` \| `reboot_vm` \| `register_cluster` \| `delete_cluster` |
| status | enum | `pending` \| `running` \| `success` \| `failed` \| `cancelled` |
| progress | integer | 0–100 |
| log | text | appended incrementally |
| celery_task_id | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### SystemConfiguration

A singleton table (enforced by a single row with a fixed primary key). Stores global operator settings managed through the admin UI, such as default cluster, VM name prefix, and feature flags.

---

## Async Job Lifecycle

```
            ┌─────────┐
            │ pending │  ← Job row created; task enqueued
            └────┬────┘
                 │ worker picks up
            ┌────▼────┐
            │ running │  ← progress 0→100, log appended
            └────┬────┘
         ┌───────┴───────┐
    ┌────▼────┐     ┌────▼────┐
    │ success │     │ failed  │
    └─────────┘     └─────────┘
```

`cancelled` is a terminal state reachable from `pending` only (before the worker picks it up). Once a job is `running` it cannot be cancelled.

The frontend polls `GET /jobs/{id}` every 2 seconds. On terminal state, polling stops and the UI updates accordingly.

---

## Authentication and Authorization Flow

1. Client sends credentials to `POST /auth/login`.
2. API verifies password hash (bcrypt), issues a short-lived **access token** (JWT, 15 min) and a **refresh token** (JWT, 7 days).
3. Client includes `Authorization: Bearer <access_token>` on every request.
4. API middleware decodes and verifies the JWT signature, extracts `user_id` and `role`.
5. Route-level decorators enforce role requirements (`admin` vs `user`).
6. When the access token expires, the client calls `POST /auth/refresh` with the refresh token to obtain a new pair.

Tokens are stateless JWTs. Logout is handled client-side by discarding tokens; the refresh token is stored in an httpOnly cookie.

For endpoint-level auth requirements, see [API_SPEC.md](API_SPEC.md).

---

## SDN Detection and Networking Modes

On cluster registration, the Driver Layer calls the Proxmox SDN API (`/cluster/sdn`). If the cluster reports SDN support, `clusters.sdn_enabled` is set to `true`.

The frontend queries `GET /clusters/{id}` and conditionally renders the SDN networking option based on `sdn_enabled`. Users on SDN-disabled clusters only see bridge-based networks.

When a VM is provisioned on an SDN network, `SDNManager` ensures the required VXLAN zone and VNet exist before attaching the VM's NIC.

| Mode | Proxmox backing | Availability |
|---|---|---|
| Standard (bridge) | Linux bridge (`vmbr0`, etc.) | Always |
| Advanced (VXLAN) | Proxmox SDN zone | Only if `sdn_enabled = true` |

---

## Key Design Decisions

### `proxmoxer` over raw HTTP requests

Using `proxmoxer` reduces boilerplate across the Driver Layer, handles SSL verification via a single flag, and provides a Pythonic interface to the Proxmox REST API tree. The tradeoff is a dependency on a third-party library; however, `proxmoxer` is well-maintained and the coupling is contained entirely within the Driver Layer.

### UUID primary keys

All entities use UUID v4 PKs rather than sequential integers. This prevents enumeration attacks (a user cannot guess adjacent resource IDs) and simplifies future cross-cluster ID management.

### No config files post-deployment

All runtime configuration (cluster credentials, flavors, feature flags) is stored in PostgreSQL and managed through the web UI. This eliminates the ops burden of editing files and restarting containers, which is critical for the target audience (teams without dedicated infra engineers).

### Docker Compose over bare Linux services

PSSCP has five interdependent services (API, worker, frontend, PostgreSQL, Redis). Docker Compose defines the entire stack in a single file, handles dependency ordering, network isolation, and volume management. This runs identically on any Linux host with Docker installed, removing environment-specific setup friction.

### Task queue: Celery vs ARQ

**TBD** — decision to be finalised before implementation. Celery is mature and battle-tested with broad ecosystem support; ARQ is lighter and async-native, which aligns better with a FastAPI codebase. Record the decision here once made.
