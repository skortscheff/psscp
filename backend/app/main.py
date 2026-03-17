from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import get_settings
from app.api import auth, clusters, flavors, networks, users, vms, jobs, system

settings = get_settings()

app = FastAPI(title="PSSCP API", version=settings.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Instrumentator().instrument(app).expose(app)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(clusters.router, prefix=PREFIX)
app.include_router(flavors.router, prefix=PREFIX)
app.include_router(networks.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(vms.router, prefix=PREFIX)
app.include_router(jobs.router, prefix=PREFIX)
app.include_router(system.router, prefix=PREFIX)
