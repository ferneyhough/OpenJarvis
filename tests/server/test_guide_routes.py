"""Tests for /v1/guide routes: links CRUD, offline guard, input validation."""

from __future__ import annotations

import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from openjarvis.server import guide_routes
from openjarvis.server.guide_routes import guide_router


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(guide_routes, "_LINKS_FILE", tmp_path / "guide_links.json")
    app = FastAPI()
    app.include_router(guide_router)
    return TestClient(app)


def test_links_crud(client):
    res = client.post(
        "/v1/guide/links",
        json={"title": "Example", "url": "https://example.com", "category": "demo"},
    )
    assert res.status_code == 200
    link = res.json()["link"]
    assert link["title"] == "Example"
    assert link["id"]

    listing = client.get("/v1/guide/links").json()["links"]
    assert [entry["id"] for entry in listing] == [link["id"]]

    patched = client.patch(f"/v1/guide/links/{link['id']}", json={"note": "hello"})
    assert patched.status_code == 200
    assert patched.json()["link"]["note"] == "hello"

    assert client.delete(f"/v1/guide/links/{link['id']}").status_code == 200
    assert client.delete(f"/v1/guide/links/{link['id']}").status_code == 404
    assert client.get("/v1/guide/links").json()["links"] == []


def test_links_reject_non_http(client):
    res = client.post("/v1/guide/links", json={"title": "x", "url": "ftp://bad"})
    assert res.status_code == 400


def test_links_persist_across_loads(client, tmp_path):
    client.post("/v1/guide/links", json={"title": "A", "url": "https://a.com"})
    client.post("/v1/guide/links", json={"title": "B", "url": "https://b.com"})
    on_disk = json.loads((tmp_path / "guide_links.json").read_text())
    assert len(on_disk) == 2


def test_tv_requires_online(client, monkeypatch):
    class _Cfg:
        offline_mode = True

    monkeypatch.setattr("openjarvis.core.config.load_config", lambda: _Cfg())
    res = client.get("/v1/guide/tv")
    assert res.status_code == 503
    assert "Offline mode" in res.json()["detail"]


def test_catalog_rejects_bad_type(client, monkeypatch):
    class _Cfg:
        offline_mode = False

    monkeypatch.setattr("openjarvis.core.config.load_config", lambda: _Cfg())
    assert client.get("/v1/guide/catalog/book").status_code == 400


def test_search_validates_query(client, monkeypatch):
    class _Cfg:
        offline_mode = False

    monkeypatch.setattr("openjarvis.core.config.load_config", lambda: _Cfg())
    assert client.get("/v1/guide/search?q=x").status_code == 400
    assert client.get("/v1/guide/search?q=test&type=podcast").status_code == 400
