"""Tests for iVue webgrab EPG routes: parsers, time localization, scrape
windowing, payload filtering, and the stale-while-revalidate cache."""

from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from openjarvis.server import ivue_routes
from openjarvis.server.ivue_routes import ivue_router


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(ivue_routes, "CACHE_PATH", tmp_path / "ivue.json")
    ivue_routes._cache["ts"] = 0.0
    ivue_routes._cache["payload"] = None
    app = FastAPI()
    app.include_router(ivue_router)
    return TestClient(app)


def _usca_html(rows: list[tuple[str, str]]) -> str:
    items = "".join(
        f'<div class="list-group-item" data-st="{when}" '
        f'data-showtitle="{title}" data-description="desc">'
        f'<a>{title}</a><p>x</p><p>desc</p><span class="teams">{title}</span></div>'
        for when, title in rows
    )
    return f"<html><body>{items}</body></html>"


def _au_html(rows: list[tuple[str, str, str]]) -> str:
    trs = "".join(
        f"<tr><td><h5 class='thin'>{t}</h5><a>{title}</a><h6>{desc}</h6></td></tr>"
        for t, title, desc in rows
    )
    return f"<html><body><table>{trs}</table></body></html>"


def _source(style: str = "usca", tz: str = "America/New_York") -> dict:
    return {"name": "TestChan", "url": "https://x.test", "logo": "",
            "region": "US", "region_label": "US", "tz": tz, "style": style}


# ---------------------------------------------------------------------------
# parsers
# ---------------------------------------------------------------------------

def test_parse_usca_extracts_rows():
    day = datetime(2025, 6, 1)
    html = _usca_html([
        ("2025-06-01 20:00:00", "Show A"),
        ("2025-06-01 21:00:00", "Show B"),
    ])
    rows = ivue_routes._parse_usca(html, day)
    assert [r["title"] for r in rows] == ["Show A", "Show B"]
    assert rows[0]["start_raw"] == "2025-06-01 20:00:00"


def test_parse_usca_sorts_by_start():
    day = datetime(2025, 6, 1)
    html = _usca_html([
        ("2025-06-01 22:00:00", "Late"),
        ("2025-06-01 20:00:00", "Early"),
    ])
    rows = ivue_routes._parse_usca(html, day)
    assert rows[0]["title"] == "Early"


def test_parse_au_keeps_document_order():
    day = datetime(2025, 6, 1)
    html = _au_html([
        ("9:30 PM", "Night Show", "desc"),
        ("7:30 AM", "Morning Show", "desc"),
    ])
    rows = ivue_routes._parse_au(html, day)
    # document order preserved — "9:30 PM" sorts before "7:30 AM" as strings
    assert [r["title"] for r in rows] == ["Night Show", "Morning Show"]
    assert rows[0]["time"] == "9:30 PM"


# ---------------------------------------------------------------------------
# localization
# ---------------------------------------------------------------------------

def test_localize_usca_epoch_ms():
    row = {"start_raw": "2025-01-15 20:00:00", "title": "t", "desc": ""}
    out = ivue_routes._localize(row, "America/New_York", datetime(2025, 1, 15))
    assert out is not None
    expected = datetime(2025, 1, 15, 20, 0, tzinfo=ZoneInfo("America/New_York")).timestamp() * 1000
    assert out["start"] == pytest.approx(expected)


def test_localize_au_time():
    row = {"time": "7:30 PM", "title": "t", "desc": ""}
    day = datetime(2025, 6, 1)
    out = ivue_routes._localize(row, "Australia/Adelaide", day)
    assert out is not None
    expected = datetime(2025, 6, 1, 19, 30, tzinfo=ZoneInfo("Australia/Adelaide")).timestamp() * 1000
    assert out["start"] == pytest.approx(expected)


def test_localize_bad_input_returns_none():
    assert ivue_routes._localize({"time": "not a time"}, "UTC", datetime(2025, 1, 1)) is None
    assert ivue_routes._localize({}, "UTC", datetime(2025, 1, 1)) is None


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def test_slug():
    assert ivue_routes._slug("CNN New York!") == "cnn-new-york"
    assert ivue_routes._slug("") == ""


def test_page_urls_styles():
    src = _source(style="usca")
    assert ivue_routes._page_urls(src, datetime(2025, 6, 1)) == ["https://x.test/2025-06-01"]
    src["style"] = "au"
    assert ivue_routes._page_urls(src, datetime(2025, 6, 1)) == ["https://x.test?dt=2025-06-01"]


# ---------------------------------------------------------------------------
# scrape windowing
# ---------------------------------------------------------------------------

def test_scrape_source_builds_programmes(monkeypatch):
    # rows are naive local times in the source tz — use UTC so epoch math is exact
    now = datetime.now(ZoneInfo("UTC")).replace(tzinfo=None)
    dstr = now.strftime("%Y-%m-%d")
    html = _usca_html([
        ((now - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"), "Old Show"),
        ((now - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S"), "Recent Show"),
        ((now + timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"), "Soon Show"),
        ((now + timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S"), "Later Show"),
    ])
    monkeypatch.setattr(
        ivue_routes, "_fetch",
        lambda url: html if dstr in url else "",   # only today's page has rows
    )
    progs = ivue_routes._scrape_source(_source(tz="UTC"), [now, now + timedelta(days=1)])
    titles = [p["title"] for p in progs]
    assert "Old Show" not in titles          # outside the -1h window
    assert "Recent Show" in titles and "Soon Show" in titles and "Later Show" in titles
    # stop of an interior programme = next programme's start
    for i in range(len(progs) - 1):
        assert progs[i]["stop"] == progs[i + 1]["start"]
    # last programme gets +30min
    assert progs[-1]["stop"] - progs[-1]["start"] == 30 * 60 * 1000


def test_scrape_source_deadline_stops_fetching(monkeypatch):
    calls = []

    def fake_fetch(url):
        calls.append(url)
        return ""

    monkeypatch.setattr(ivue_routes, "_fetch", fake_fetch)
    days = [datetime.now() + timedelta(days=d) for d in range(3)]
    # deadline already passed -> no fetches at all
    progs = ivue_routes._scrape_source(_source(), days, deadline=time.monotonic() - 1)
    assert progs == []
    assert calls == []


# ---------------------------------------------------------------------------
# payload assembly
# ---------------------------------------------------------------------------

def test_build_payload_drops_empty_channels(monkeypatch):
    sources = [_source(), {**_source(), "name": "DeadChan"}]
    monkeypatch.setattr(ivue_routes, "_load_sources", lambda: sources)

    def fake_scrape(src, days, deadline=None):
        return [{"title": "t", "desc": "", "start": 1, "stop": 2}] if src["name"] == "TestChan" else []

    monkeypatch.setattr(ivue_routes, "_scrape_source", fake_scrape)
    payload = ivue_routes._build_payload()
    assert payload["count"] == 1
    assert payload["channels"][0]["name"] == "TestChan"
    assert payload["channels"][0]["id"].startswith("ivue-us-")


# ---------------------------------------------------------------------------
# endpoint cache behaviour
# ---------------------------------------------------------------------------

def test_endpoint_caches_fresh_payload(client, monkeypatch):
    calls = []
    payload = {"channels": [{"id": "c1", "name": "N", "schedule": []}], "count": 1}
    monkeypatch.setattr(ivue_routes, "_build_payload",
                        lambda: calls.append(1) or payload)
    assert client.get("/v1/guide/ivue").json()["count"] == 1
    assert client.get("/v1/guide/ivue").json()["count"] == 1
    assert len(calls) == 1


def test_endpoint_serves_stale_and_refreshes(client, monkeypatch):
    refreshes = []
    monkeypatch.setattr(ivue_routes, "_refresh_async", lambda: refreshes.append(1))
    ivue_routes._cache["payload"] = {"channels": [], "count": 7}
    ivue_routes._cache["ts"] = time.time() - ivue_routes.CACHE_TTL - 1

    res = client.get("/v1/guide/ivue").json()
    assert res["count"] == 7
    assert res["stale"] is True
    assert refreshes == [1]


def test_endpoint_disk_fallback(client, monkeypatch):
    refreshes = []
    monkeypatch.setattr(ivue_routes, "_refresh_async", lambda: refreshes.append(1))
    disk_payload = {"channels": [{"id": "d"}], "count": 3}
    ivue_routes.CACHE_PATH.write_text(
        json.dumps({"ts": time.time() - 100, "payload": disk_payload})
    )

    res = client.get("/v1/guide/ivue").json()
    assert res["count"] == 3
    assert res["stale"] is True
    assert refreshes == [1]
    # disk payload adopted into memory cache
    assert ivue_routes._cache["payload"]["count"] == 3


def test_endpoint_persists_fresh_build(client, monkeypatch, tmp_path):
    payload = {"channels": [], "count": 0}
    monkeypatch.setattr(ivue_routes, "_build_payload", lambda: payload)
    res = client.get("/v1/guide/ivue").json()
    assert "stale" not in res
    assert ivue_routes.CACHE_PATH.exists()
    disk = json.loads(ivue_routes.CACHE_PATH.read_text())
    assert disk["payload"]["count"] == 0
