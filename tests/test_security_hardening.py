"""Unit tests for SECURITY_AUDIT hardening: route-aware body limits, JWT iss/aud."""

import jwt
import pytest
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

from core.config import settings
from core.jwt_auth import JWT_AUDIENCE, JWT_ISSUER, create_access_token, decode_access_token
from core.middleware import BodySizeLimitMiddleware


def _app() -> TestClient:
    app = FastAPI()

    @app.post("/small")
    async def small(request: Request):
        return {"n": len(await request.body())}

    @app.post("/upload")
    async def upload(request: Request):
        return {"n": len(await request.body())}

    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=5_000,
        default_bytes=100,
        route_limits={("POST", "/upload"): 2_000},
    )
    return TestClient(app)


def test_default_limit_applies_to_ordinary_routes():
    c = _app()
    assert c.post("/small", content=b"x" * 50).status_code == 200
    assert c.post("/small", content=b"x" * 500).status_code == 413


def test_route_limit_is_higher_for_upload_but_capped_by_outer_limit():
    c = _app()
    assert c.post("/upload", content=b"x" * 1_500).status_code == 200
    assert c.post("/upload", content=b"x" * 3_000).status_code == 413


def test_access_token_carries_issuer_and_audience():
    token, _ = create_access_token("u1", scopes=["admin"])
    claims = decode_access_token(token)
    assert claims["iss"] == JWT_ISSUER and claims["aud"] == JWT_AUDIENCE


def test_token_with_wrong_audience_is_rejected():
    forged = jwt.encode(
        {"sub": "u1", "type": "access", "aud": "someone-else", "iss": JWT_ISSUER, "exp": 4102444800},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(HTTPException) as e:
        decode_access_token(forged)
    assert e.value.status_code == 401


def test_default_limits_are_sane():
    assert settings.MAX_DEFAULT_BODY_BYTES <= 1_000_000
    assert settings.MAX_PDF_PAGES == 50
