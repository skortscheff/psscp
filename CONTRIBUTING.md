# Contributing to PSSCP

This guide covers local development setup, test commands, code conventions, and the workflows for adding new features. For architecture background, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Prerequisites

| Tool | Minimum version |
|---|---|
| Python | 3.11 |
| Node.js | 20 LTS |
| Docker + Docker Compose | 24 / 2.20 |
| Git | 2.x |

---

## Repository Layout

Once implemented, the repository will be structured as follows:

```
/backend            — FastAPI application, Celery tasks, Driver Layer
  /app
    /api            — Route handlers (thin layer only)
    /services       — Business logic called by route handlers
    /models         — SQLModel ORM models
    /schemas        — Pydantic v2 request/response shapes
    /driver         — Proxmox Driver Layer (ProxmoxClient, VMProvisioner, etc.)
    /tasks          — Celery task definitions
    main.py
  /tests
    /unit           — Pure unit tests (no DB, no network)
    /integration    — Tests against a real DB and Redis
  requirements.txt
  requirements-dev.txt

/frontend           — React application (Vite + TypeScript)
  /src
  package.json

/docker             — Dockerfiles for each service
/migrations         — Alembic migration scripts
docker-compose.yml
docker-compose.dev.yml
```

---

## Local Development Setup

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env.local
docker-compose -f docker-compose.dev.yml up -d postgres redis
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Worker

In a separate terminal (same virtualenv):

```bash
cd backend
celery -A app.tasks worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server will be available at `http://localhost:5173` and proxies `/api` requests to the backend.

### Full Stack

To run all services together (mirrors production):

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This builds local images for the API, worker, and frontend, and starts PostgreSQL and Redis alongside them.

---

## Running Tests

### Backend Unit Tests

```bash
cd backend
pytest tests/unit
```

Unit tests must not touch the database or Redis. Mock the service layer at the route boundary.

### Backend Integration Tests

Integration tests run against a real PostgreSQL database and Redis. Start them first:

```bash
docker-compose -f docker-compose.dev.yml up -d postgres redis
pytest tests/integration
```

Do not mock the database in integration tests — tests should exercise actual SQL queries. See the [testing rationale in ARCHITECTURE.md](ARCHITECTURE.md).

### Frontend Tests

```bash
cd frontend
npm test               # unit tests (Vitest)
npm run test:e2e       # end-to-end tests (Playwright)
```

### Coverage

```bash
cd backend
pytest --cov=app --cov-report=term-missing tests/
```

---

## Code Conventions

### Python

- **Formatter:** `black` with line length 88
- **Linter:** `ruff` (replaces flake8 + isort)
- **Type annotations:** required on all public functions and methods
- **ORM:** SQLModel (combines SQLAlchemy + Pydantic)
- **Validation:** Pydantic v2 (no v1 compatibility shims)
- **Service layer:** route handlers must not contain business logic or direct database queries. Call a service function instead.

Example of correct layering:

```python
# app/api/vms.py — route handler
@router.post("/vms", status_code=202)
async def create_vm(body: VMCreateRequest, user: CurrentUser, db: Session) -> JobResponse:
    return await vm_service.enqueue_create(db, user, body)

# app/services/vms.py — service layer (contains logic)
async def enqueue_create(db: Session, user: User, body: VMCreateRequest) -> JobResponse:
    ...
```

Run both tools before committing:

```bash
black backend/
ruff check backend/ --fix
```

### TypeScript / React

- **TypeScript strict mode** is enabled. Do not use `any`.
- **ESLint + Prettier** for linting and formatting.
- **API client:** use the typed API client generated from the OpenAPI schema. Do not write raw `fetch` calls in components.
- Component state for long-running operations must use the job polling pattern (see [ARCHITECTURE.md § Frontend](ARCHITECTURE.md#frontend-react)).

```bash
cd frontend
npm run lint
npm run format
```

### Git Workflow

- **Branch naming:** `feat/short-description`, `fix/short-description`, `chore/short-description`
- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) format:
  ```
  feat(vms): add reboot endpoint
  fix(worker): handle proxmox timeout on clone
  chore(deps): bump proxmoxer to 2.1.0
  ```
- **Merge strategy:** squash merge into `main`. Each PR lands as a single commit.
- Keep PRs focused. One feature or fix per PR.

---

## Adding a New API Endpoint

1. Add the route handler to the appropriate file under `app/api/`.
2. Create or extend a service function in `app/services/`.
3. Define request/response Pydantic schemas in `app/schemas/`.
4. If the operation mutates Proxmox, have the service create a `Job` row and enqueue a Celery task. Return `202 Accepted` with `job_id`.
5. Add the endpoint to [API_SPEC.md](API_SPEC.md).
6. Write unit tests for the service function, integration tests for the route.

---

## Adding a New Driver Operation

1. Add a method to the appropriate Driver Layer class in `app/driver/`.
2. Write a corresponding Celery task in `app/tasks/` that calls the driver method and updates `Job.progress` / `Job.log` incrementally.
3. Add the new `job.type` value to the `JobType` enum in `app/models/`.
4. Create an Alembic migration if the enum change requires a database schema update (see below).
5. Register the task in the Celery application.

---

## Database Migrations

All schema changes go through Alembic.

**Generate a migration after changing a SQLModel model:**

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
```

**Review the generated migration** in `migrations/versions/` before committing. Autogenerate is not always correct — check for missing enum updates, index changes, or data migrations.

**Apply migrations:**

```bash
alembic upgrade head
```

**Roll back one step:**

```bash
alembic downgrade -1
```

Never modify a migration that has already been applied in any environment. Write a new migration instead.
