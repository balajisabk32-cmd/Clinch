"""Every endpoint must refuse an anonymous caller, except the few that cannot.

This exists because the mutating endpoints were all correctly gated while the
READS were not, and the test suite could not see the difference: the reads
returned 200 with the full pipeline -- every customer, every discount, every
margin -- to anyone who could reach the port. A per-endpoint test would only
have covered the endpoints someone remembered to write one for, so this walks
the app's own route table instead and therefore also covers routes added later.

Adding a genuinely public route means adding it to PUBLIC below, which is a
deliberate act with a reviewer attached rather than an omission.
"""

import pytest
from fastapi.testclient import TestClient

from api.main import app
from .conftest import REP

client = TestClient(app)

# Public by design, each for a stated reason.
PUBLIC = {
    ("POST", "/auth/login"),          # the door itself
    ("POST", "/auth/logout"),         # idempotent, reveals nothing
    ("POST", "/auth/password-policy"),# the rules, so the UI can show them live
    ("GET",  "/health"),              # liveness probe
    ("GET",  "/_status"),             # build/endpoint board
    ("GET",  "/events/stream"),       # SSE; carries no privileged payload
    # The customer portal authenticates with a signed single-quote token in the
    # PATH, not a bearer header, and is field-redacted server-side (PS §7).
    ("GET",  "/portal/{token}"),
    ("POST", "/portal/{token}/request"),
    # FastAPI's own docs. They describe the shape of the API, never its data,
    # and the API does not leave localhost in this deployment.
    ("GET",  "/docs"),
    ("GET",  "/docs/oauth2-redirect"),
    ("GET",  "/redoc"),
    ("GET",  "/openapi.json"),
}

# A path parameter has to be filled with something to reach the guard at all.
SAMPLE = {"ref": "Q-1042", "sku": "HW-LAPTOP-01", "idx": "0",
          "token": "unused", "sub_id": "1", "user_id": "rep_rao"}


def _routes():
    for r in app.routes:
        methods = getattr(r, "methods", None)
        path = getattr(r, "path", None)
        if not methods or not path:
            continue
        for m in methods:
            if m in ("HEAD", "OPTIONS"):
                continue
            yield m, path


def _fill(path: str) -> str:
    out = path
    for key, val in SAMPLE.items():
        out = out.replace("{" + key + "}", val)
    return out


@pytest.mark.parametrize("method,path",
                         [(m, p) for m, p in _routes() if (m, p) not in PUBLIC])
def test_endpoint_rejects_anonymous_callers(method, path):
    r = client.request(method, _fill(path), json={})
    assert r.status_code == 401, (
        f"{method} {path} answered {r.status_code} without a token. "
        "If it is meant to be public, add it to PUBLIC with a reason."
    )


def test_the_public_list_is_not_quietly_growing():
    """A tripwire: PUBLIC is small on purpose."""
    assert len(PUBLIC) == 12, (
        "The set of unauthenticated endpoints changed. That is allowed, but it "
        "should be a decision -- update this count deliberately."
    )


def test_a_valid_token_still_gets_through():
    """The guard must refuse anonymity, not everything."""
    assert client.get("/quotes", headers=REP).status_code == 200
