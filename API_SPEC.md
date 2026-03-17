# API Specification

This document defines the HTTP API exposed by the PSSCP backend. For authentication flow narrative, see [ARCHITECTURE.md § Authentication](ARCHITECTURE.md#authentication-and-authorization-flow). For the data model schema, see [ARCHITECTURE.md § Data Model](ARCHITECTURE.md#data-model).

---

## Base URL and Versioning

All endpoints are prefixed with `/api/v1/`.

The version segment is part of the URL, not a header. Breaking changes will increment the version number.

---

## Authentication

### POST /auth/login

Authenticate with email and password. Returns an access token and sets a refresh token cookie.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```

**Response `200 OK`**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 900
}
```

The refresh token is returned as an httpOnly `Set-Cookie: refresh_token=...` header. It is not in the response body.

**Errors:** `401` invalid credentials, `403` account inactive.

---

### POST /auth/refresh

Exchange a valid refresh token cookie for a new access/refresh token pair.

**Request:** No body. Refresh token is read from the `refresh_token` cookie.

**Response `200 OK`** — same shape as `/auth/login`.

**Errors:** `401` refresh token missing, expired, or invalid.

---

### POST /auth/logout

Invalidate the current session client-side. Clears the refresh token cookie.

**Request:** Requires `Authorization: Bearer <access_token>`.

**Response `204 No Content`**

---

### Token Usage

Include the access token on every authenticated request:

```
Authorization: Bearer <access_token>
```

### Role Matrix

| Role | Can access |
|---|---|
| `admin` | All endpoints |
| `user` | Own VMs and jobs; read-only flavors and networks; own user record |

Specific per-endpoint requirements are noted in each section below.

---

## Error Response Format

All error responses use a consistent envelope:

```json
{
  "detail": "Human-readable description of the error.",
  "code": "machine_readable_error_code",
  "field_errors": {
    "field_name": "Validation message for this field."
  }
}
```

`field_errors` is omitted when the error is not field-specific (e.g. `404 Not Found`, `403 Forbidden`).

**Common HTTP status codes:**

| Code | Meaning |
|---|---|
| `400` | Malformed request or failed validation |
| `401` | Missing or invalid token |
| `403` | Authenticated but insufficient role |
| `404` | Resource not found |
| `409` | Conflict (e.g. resource in use, duplicate name) |
| `422` | Unprocessable entity (Pydantic validation error) |
| `500` | Internal server error |

---

## Async Operations Convention

Operations that interact with Proxmox return `202 Accepted` immediately:

```json
{
  "job_id": "uuid"
}
```

The caller polls `GET /jobs/{id}` until `status` is `success`, `failed`, or `cancelled`. See [Jobs](#jobs) for the polling endpoint.

Synchronous write operations (e.g. updating a flavor name, creating a user) return `200 OK` or `201 Created` with the updated resource.

---

## Resource Endpoints

---

### Clusters

> **Admin only** for all write operations. Users have no access to cluster endpoints.

#### GET /clusters

List all active clusters.

**Response `200 OK`**
```json
[ClusterSummary]
```

#### POST /clusters

Register a new Proxmox cluster. Triggers an async `register_cluster` job that verifies connectivity and detects SDN capability.

**Request body**
```json
{
  "name": "string",
  "api_url": "https://proxmox.example.com:8006",
  "api_token_id": "user@pam!mytoken",
  "api_token_secret": "string",
  "tls_verify": true
}
```

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

**Errors:** `409` name already taken.

#### GET /clusters/{id}

**Response `200 OK`** → `ClusterDetail`

Note: `api_token_secret` is **never** returned in any GET response.

#### PATCH /clusters/{id}

Update cluster metadata or credentials. Accepts any subset of the create body fields.

**Response `200 OK`** → `ClusterDetail`

#### DELETE /clusters/{id}

Triggers an async `delete_cluster` job.

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

**Errors:** `409` cluster has active VMs.

---

### Flavors

> **Admin** write; **User** read.

#### GET /flavors

List all active flavors. Optionally filter by cluster: `?cluster_id=uuid`.

**Response `200 OK`**
```json
[FlavorSummary]
```

#### POST /flavors

**Admin only.**

**Request body**
```json
{
  "cluster_id": "uuid",
  "name": "string",
  "vcpus": 2,
  "ram_mb": 2048,
  "disk_gb": 20,
  "disk_bus": "virtio"
}
```

**Response `201 Created`** → `FlavorDetail`

**Errors:** `409` name already taken within the cluster.

#### GET /flavors/{id}

**Response `200 OK`** → `FlavorDetail`

#### PATCH /flavors/{id}

**Admin only.** Update flavor metadata. Cannot change `cluster_id`.

**Response `200 OK`** → `FlavorDetail`

#### DELETE /flavors/{id}

**Admin only.**

**Response `204 No Content`**

**Errors:** `409` flavor is referenced by one or more VMs.

---

### VMs

> **User** can manage own VMs. **Admin** can see and manage all VMs.

#### GET /vms

List VMs. Users see only their own. Admins see all. Supports `?status=running` filter.

**Response `200 OK`**
```json
[VMSummary]
```

#### POST /vms

Provision a new VM. Triggers an async `create_vm` job.

**Request body**
```json
{
  "name": "string",
  "cluster_id": "uuid",
  "flavor_id": "uuid",
  "template_id": "string",
  "network_id": "uuid"
}
```

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

**Errors:** `400` SDN network requested but cluster has `sdn_enabled = false`.

#### GET /vms/{id}

Users can only fetch their own VMs.

**Response `200 OK`** → `VMDetail`

#### DELETE /vms/{id}

Triggers an async `delete_vm` job. VM must not be in `provisioning` state.

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

**Errors:** `409` VM is currently provisioning.

#### POST /vms/{id}/start

Triggers an async `start_vm` job.

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

#### POST /vms/{id}/stop

Triggers an async `stop_vm` job.

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

#### POST /vms/{id}/reboot

Triggers an async `reboot_vm` job.

**Response `202 Accepted`** → `{ "job_id": "uuid" }`

---

### Networks

> **Admin** write; **User** read (only networks on clusters they can provision to).

#### GET /networks

List networks. Optionally filter by cluster: `?cluster_id=uuid`.

**Response `200 OK`**
```json
[NetworkSummary]
```

#### POST /networks

**Admin only.**

**Request body**
```json
{
  "cluster_id": "uuid",
  "name": "string",
  "type": "bridge",
  "bridge_name": "vmbr0",
  "vxlan_id": null
}
```

For `type: vxlan`, `vxlan_id` must be provided and `cluster.sdn_enabled` must be `true`.

**Response `201 Created`** → `NetworkDetail`

**Errors:** `400` VXLAN requested but SDN not enabled on cluster; `409` name conflict.

#### GET /networks/{id}

**Response `200 OK`** → `NetworkDetail`

#### DELETE /networks/{id}

**Admin only.**

**Response `204 No Content`**

**Errors:** `409` network is attached to one or more VMs.

---

### Jobs

> **User** can read their own jobs. **Admin** can read all jobs.

#### GET /jobs

List jobs. Users see only their own. Supports `?status=running&type=create_vm` filters.

**Response `200 OK`**
```json
[JobSummary]
```

#### GET /jobs/{id}

Poll this endpoint for job progress. Users can only access their own jobs.

**Response `200 OK`** → `JobDetail`

---

### Users

#### GET /users

**Admin only.** List all users.

**Response `200 OK`**
```json
[UserSummary]
```

#### POST /users

**Admin only.** Create a new user.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "string",
  "role": "user"
}
```

**Response `201 Created`** → `UserDetail`

**Errors:** `409` email already registered.

#### GET /users/me

Returns the currently authenticated user's profile.

**Response `200 OK`** → `UserDetail`

#### GET /users/{id}

**Admin only.**

**Response `200 OK`** → `UserDetail`

#### PATCH /users/{id}

**Admin only** for role changes; user can patch their own record for password/email.

**Response `200 OK`** → `UserDetail`

#### DELETE /users/{id}

**Admin only.** Soft-deletes (sets `is_active = false`).

**Response `204 No Content`**

**Errors:** `409` user has active VMs.

---

### System Configuration

> **Admin only.**

#### GET /system/config

Return current system configuration.

**Response `200 OK`** → `SystemConfig`

#### PATCH /system/config

Update one or more configuration values.

**Response `200 OK`** → `SystemConfig`

---

### Health

#### GET /system/health

Public endpoint (no auth required). Returns API and dependency health.

**Response `200 OK`**
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok",
  "version": "0.1.0"
}
```

**Response `503 Service Unavailable`** if any dependency is unreachable (same body shape, `status: "degraded"`).

---

## Schema Reference

### ClusterSummary

```json
{
  "id": "uuid",
  "name": "string",
  "api_url": "string",
  "api_token_id": "string",
  "tls_verify": true,
  "sdn_enabled": false,
  "is_active": true
}
```

### ClusterDetail

Extends `ClusterSummary`. No additional fields. (`api_token_secret` is never returned.)

### FlavorSummary

```json
{
  "id": "uuid",
  "cluster_id": "uuid",
  "name": "string",
  "vcpus": 2,
  "ram_mb": 2048,
  "disk_gb": 20,
  "disk_bus": "virtio",
  "is_active": true
}
```

### FlavorDetail

Same as `FlavorSummary`.

### VMSummary

```json
{
  "id": "uuid",
  "name": "string",
  "status": "running",
  "cluster_id": "uuid",
  "flavor_id": "uuid",
  "ip_address": "10.0.0.5",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### VMDetail

Extends `VMSummary`:

```json
{
  "user_id": "uuid",
  "network_id": "uuid",
  "proxmox_vmid": 105
}
```

### NetworkSummary

```json
{
  "id": "uuid",
  "cluster_id": "uuid",
  "name": "string",
  "type": "bridge",
  "bridge_name": "vmbr0",
  "vxlan_id": null
}
```

### NetworkDetail

Same as `NetworkSummary`.

### JobSummary

```json
{
  "id": "uuid",
  "type": "create_vm",
  "status": "running",
  "progress": 42,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:10Z"
}
```

### JobDetail

Extends `JobSummary`:

```json
{
  "user_id": "uuid",
  "vm_id": "uuid",
  "log": "Cloning template...\nConfiguring network...",
  "celery_task_id": "string"
}
```

### UserSummary

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "user",
  "is_active": true,
  "created_at": "2026-01-01T00:00:00Z"
}
```

### UserDetail

Same as `UserSummary`.

### SystemConfig

```json
{
  "default_cluster_id": "uuid",
  "vm_name_prefix": "vm-",
  "max_vms_per_user": 10,
  "allow_self_registration": false
}
```
