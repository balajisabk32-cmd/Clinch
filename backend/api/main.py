"""DealFlow360 API.

Run:  uvicorn api.main:app --reload --port 8000
Docs: http://localhost:8000/docs        (auto-generated from the contracts)
Board: http://localhost:8000/_status    (which endpoints are real vs stub)
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import registry, state
from .accounts import accounts, admin
from .billing import billing, customer_billing
from .storefront import storefront
from .inventory import inventory
from .plans import plans
from .reporting import reporting
from .routers import infra, insights, intelligence, operations, portal, sales

app = FastAPI(
    title="DealFlow360",
    version="0.1.0",
    description=(
        "Self-governing sales operations platform. The intelligence endpoints "
        "(score, coach, recommend, policy/simulate) are real; the rest return "
        "contract-shaped fixtures until their owners land the real handlers. "
        "GET /_status reports which is which."
    ),
)

# Vite dev server. Wide open on purpose: this never leaves localhost.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (accounts, admin, storefront, inventory, plans, reporting,
          intelligence, sales, operations, portal, insights, infra,
          billing, customer_billing):
    app.include_router(r)


# Load the working set from SQLite, seeding it on first run.
#
# Done at import rather than in a startup event on purpose: lifespan events do
# not fire under a plain TestClient, which meant the app silently ran on
# fixture defaults in tests while looking correct in uvicorn -- exactly the kind
# of "works in one context only" gap that surfaces at the worst moment.
state.boot()


@app.middleware("http")
async def persist_after_mutation(request, call_next):
    """Write the working set back to SQLite after anything that changed it.

    Flushing centrally rather than at each call site means a new endpoint is
    durable the moment it is written -- there is no per-handler save to forget.
    Reads are untouched, so the Policy Simulator keeps its in-memory hot path.
    """
    response = await call_next(request)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and response.status_code < 400:
        try:
            state.persist()
        except Exception as exc:                      # never fail a good request
            import logging
            logging.getLogger("clinch").warning("persist failed: %s", exc)
    return response


@app.get("/_status", tags=["infra"])
def status() -> dict:
    """Live integration board — see registry.py."""
    return registry.summary()


@app.get("/health", tags=["infra"])
def health() -> dict:
    return {"ok": True}
