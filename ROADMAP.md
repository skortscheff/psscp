# PSSCP Roadmap

This document describes planned development for PSSCP from v0.6 through v1.0. Implementation details (file lists, migration names, task signatures) live in the codebase; this roadmap describes goals and capabilities at a user-facing level.

---

## Current State (v0.5)

The following are fully implemented and operational:

- VM lifecycle (create, start, stop, reboot, delete) via self-service UI
- Live cluster resource dashboards (CPU, RAM, storage) pulled in real time from Proxmox
- Multi-cluster support with dynamic capability detection
- Async job model — all Proxmox operations are queued, tracked, and displayed with live progress
- Admin UI for clusters, flavors, networks, users, and system configuration
- JWT authentication with role-based access (Admin / User)

---

## Version Summary

| Version  | Theme                      | Key capability added                        |
|----------|----------------------------|---------------------------------------------|
| v0.5     | Live resources + dashboard | Proxmox-native views, Shodan theme          |
| **v0.6** | Operational hardening      | Quota enforcement, self-reg, rate limiting  |
| **v0.7** | Console + cloud-init       | Browser terminal, SSH key injection         |
| **v0.8** | Snapshots + expiry         | Snapshot/rollback, TTL-based cleanup        |
| **v0.9** | Teams + reporting          | Multi-tenancy, usage data, notifications    |
| **v1.0** | ISO provisioning + IPAM    | Template-free provisioning, static IPs      |

---

## v0.6 — Operational Hardening

**Goal:** Close enforcement gaps and make the system safe to expose to real users.

### Key capabilities
- **VM quota enforcement** — `max_vms_per_user` is currently stored in config but not checked; v0.6 enforces it at VM create time with a clear error when the limit is reached.
- **Self-registration** — a `/register` endpoint and page, gated by an admin toggle (`allow_self_registration`). Disabled by default.
- **API rate limiting** — per-IP limits on auth endpoints; per-token limits on all others.
- **SSH key management** — users add an SSH public key to their profile; keys are injected via cloud-init at VM provision time (graceful fallback if the template does not support cloud-init).

### User-visible changes
- VM create modal shows remaining quota (e.g. "2 of 5 VMs used")
- Login page shows a "Register" link when self-registration is enabled
- Profile page has an SSH public key field
- Admin config panel has a live self-registration toggle

---

## v0.7 — VM Console & Cloud-Init

**Goal:** Users can open a browser terminal to their VM. Cloud-init enables proper hostname, SSH key, and network injection at boot.

### Key capabilities
- **Browser console** — "Open Console" button on the VM detail page opens an `xterm.js` terminal connected to a WebSocket proxy that relays to the Proxmox VNC endpoint. Ownership is validated server-side.
- **Cloud-init injection** — on VM clone, if the template has a cloud-init drive, PSSCP automatically sets `ciuser`, `sshkeys`, `hostname`, and `ipconfig0=dhcp`.
- **Flavor cloud-init flag** — admins can mark a flavor as cloud-init-compatible to control injection behaviour.

### User-visible changes
- VM detail page: **Open Console** button and cloud-init status badge

---

## v0.8 — Snapshots & VM Expiry

**Goal:** Users can snapshot and restore VMs. Admins can set expiry policies to automatically reclaim idle resources.

### Key capabilities
- **Snapshots** — users can create, list, roll back to, and delete snapshots from the VM detail page. Create and rollback are async operations tracked as Jobs.
- **VM TTL / expiry** — admins set a default TTL (in days) in system config. VMs get an `expires_at` timestamp at creation. A scheduled task checks hourly and enqueues deletion for expired VMs.
- **Per-VM expiry editing** — admins can extend or clear the expiry date on any VM.

### User-visible changes
- VM detail: **Snapshots** section with create/rollback/delete and live job progress
- VM detail: expiry countdown badge
- Admin config: Default VM TTL field (0 = no expiry)

---

## v0.9 — Teams, Quotas & Reporting

**Goal:** Multiple teams share the same cluster pool with enforced resource limits. Usage data enables chargebacks and capacity planning.

### Key capabilities
- **Teams** — admins create teams and assign users (owner or member). Quotas (max VMs, vCPUs, RAM, disk) are set per team. VM creation checks team quota in addition to per-user limits.
- **Usage reporting** — running intervals are recorded per VM. Admins can query usage aggregated by user or team over a date range and export as CSV.
- **Notifications** — in-app notification bell for job success/failure, VMs expiring in 24 hours, and quota reaching 80%. Optional email delivery via SMTP.

### User-visible changes
- `/admin/teams` — create teams, manage members, set quotas
- `/admin/usage` — date range picker, per-user/team table, bar chart, CSV download
- Top bar: notification bell with unread count and dropdown
- Profile: **My Team** section with quota consumption bars

---

## v1.0 — ISO Provisioning & IPAM

**Goal:** Remove the template dependency. Users provision VMs directly from admin-curated ISO images. A built-in IPAM assigns static IPs from managed address pools.

### Key capabilities
- **ISO image registry** — admins discover ISOs present on a cluster's storage and register them with a display name and OS type. Registered ISOs appear in the VM create form.
- **ISO-based provisioner** — creates a blank VM with the chosen flavor's resources, attaches the ISO as the boot device, and starts it. No Proxmox-side template prep required.
- **Basic IPAM** — admins define IP pools (CIDR, gateway, DNS, start/end address). PSSCP allocates the next available address when a VM is created from an ISO and releases it on deletion. Admins can manually reserve or release individual addresses.

### User-visible changes
- VM create modal: **OS Image** dropdown (instead of Template) + optional **IP Pool** selector showing available address count
- VM detail: static IP displayed as primary address with pool name badge
- `/admin/isos` — discover and register ISOs per cluster
- `/admin/ipam` — create/delete pools, view address table with allocation status, manual reserve/release

---

## Cross-Cutting Conventions

All phases follow these engineering rules:

- Every new model ships with an Alembic migration.
- Every async operation goes through a Celery task and creates a Job record.
- New admin pages are added to the admin nav in `frontend/src/components/Layout.tsx`.
- Routes are thin: validation and auth in the route, business logic in the service, Proxmox calls in the driver.
- No direct database access in route handlers.
