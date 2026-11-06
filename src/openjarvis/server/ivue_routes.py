"""iVue-style webgrab EPG sources.

Channel->listing-page mappings are derived from the iVue TV Guide addon's
public ``default.ini`` (ontvtonight for AU, tvpassport for US/CA). Each page is
scraped server-side and converted into the same programme shape the IPTV grid
already consumes. Channels here carry no stream URL — they are guide-only
rows that can be matched to playable channels by name.
"""

from __future__ import annotations

import configparser
import logging
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter

log = logging.getLogger(__name__)

ivue_router = APIRouter(prefix="/v1/guide", tags=["guide"])

INI_PATH = Path(__file__).parent / "data" / "ivue_sources.ini"
CACHE_TTL = 6 * 3600
MAX_WORKERS = 32
DAYS_AHEAD = 2  # today + tomorrow so the 24h grid window is covered

# section name -> (region key, label, timezone, listing style)
SECTIONS = {
    "us channels": ("US", "United States (iVue)", "America/New_York", "usca"),
    "canada channels": ("CA", "Canada (iVue)", "America/Toronto", "usca"),
    "australia channels": ("AU", "Australia (iVue)", "Australia/Adelaide", "au"),
    # "uk channels" uses tvguide.co.uk mobile pages which now return 404.
}

UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

_cache: dict[str, Any] = {"ts": 0.0, "payload": None}
_cache_lock = threading.Lock()
_session = requests.Session()
_session.headers.update(UA)


def _load_sources() -> list[dict[str, str]]:
    cfg = configparser.ConfigParser()
    cfg.optionxform = str  # preserve channel-name case
    cfg.read(INI_PATH, encoding="utf-8")
    sources: list[dict[str, str]] = []
    for section, (region, label, tz, style) in SECTIONS.items():
        if not cfg.has_section(section):
            continue
        for name, value in cfg.items(section):
            parts = [p.strip() for p in value.split(",")]
            url = parts[0] if parts else ""
            logo = parts[1] if len(parts) > 1 else ""
            if not url.startswith("http"):
                continue
            sources.append(
                {
                    "name": name.strip(),
                    "url": url,
                    "logo": logo,
                    "region": region,
                    "region_label": label,
                    "tz": tz,
                    "style": style,
                }
            )
    return sources


def _fetch(url: str) -> str:
    try:
        r = _session.get(url, timeout=20)
        if r.status_code == 200:
            return r.text
    except Exception as exc:  # noqa: BLE001
        log.debug("ivue fetch failed %s: %s", url, exc)
    return ""


def _page_urls(source: dict[str, str], day: datetime) -> list[str]:
    base = source["url"]
    date = day.strftime("%Y-%m-%d")
    if source["style"] == "usca":
        return [f"{base}/{date}"]
    return [f"{base}?dt={date}"]


def _parse_usca(html: str, day: datetime) -> list[dict[str, Any]]:
    """tvpassport listings: div.list-group-item with data-st datetimes."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    for x in soup.find_all("div", class_="list-group-item"):
        when = x.attrs.get("data-st") or ""
        title = ""
        a = x.find("a")
        if a and a.contents:
            title = str(a.contents[0])
        if not title:
            span = x.find("span", class_="teams")
            if span and span.contents:
                title = str(span.contents[0])
        if not title:
            title = (x.attrs.get("data-showtitle") or "").strip()
        desc = x.attrs.get("data-description") or ""
        if not desc:
            ps = x.find_all("p")
            if len(ps) > 1 and ps[1].contents:
                desc = str(ps[1].contents[0])
        title = title.strip()
        if not title or not when:
            continue
        rows.append({"start_raw": when.strip(), "title": title, "desc": desc.strip()})
    rows.sort(key=lambda r: r["start_raw"])
    return [
        {"start_raw": r["start_raw"], "title": r["title"], "desc": r["desc"]}
        for r in rows
        if r["title"]
    ]


def _parse_au(html: str, day: datetime) -> list[dict[str, Any]]:
    """ontvtonight AU listings: table rows, h5.thin time, a title, h6 desc."""
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    for tr in soup.select("tr"):
        if tr.script:
            continue
        for td in tr.find_all("td"):
            ttime_el = td.find("h5", class_="thin")
            if not ttime_el:
                continue
            ttime = ttime_el.text.strip()
            if not ttime[:1].isdigit():
                continue
            a = td.find("a")
            title = a.text.strip() if a else ""
            h6 = td.find("h6")
            desc = h6.text.strip() if h6 else ""
            if title:
                rows.append({"time": ttime, "title": title, "desc": desc})
    # keep document order — listing pages are already chronological and times
    # like "12:30 AM" do not sort correctly as strings
    return [
        {"time": r["time"], "title": r["title"], "desc": r["desc"]}
        for r in rows
        if r["title"]
    ]


def _localize(row: dict[str, Any], tz: str, day: datetime) -> dict[str, Any] | None:
    """Convert naive local listing time to epoch ms in the region timezone."""
    try:
        if row.get("start_raw"):
            dt = datetime.strptime(row["start_raw"], "%Y-%m-%d %H:%M:%S")
        else:
            dt = datetime.strptime(f"{day:%Y-%m-%d} {row['time']}", "%Y-%m-%d %I:%M %p")
    except (KeyError, ValueError):
        return None
    try:
        start_ms = dt.replace(tzinfo=ZoneInfo(tz)).timestamp() * 1000
    except Exception:
        return None
    return {"start": start_ms, "title": row["title"], "desc": row.get("desc", "")}


def _scrape_source(source: dict[str, str], days: list[datetime]) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for day in days:
        for url in _page_urls(source, day):
            html = _fetch(url)
            if not html:
                continue
            if source["style"] == "usca":
                rows = _parse_usca(html, day)
            else:
                rows = _parse_au(html, day)
            for row in rows:
                if "start_raw" in row:
                    dt = _localize(row, source["tz"], day)
                else:
                    dt = _localize(row, source["tz"], day)
                if dt:
                    collected.append(dt)
    # Late-night rows (e.g. "12:30 AM" on today's AU page) belong to the next
    # day — roll forward while a start is not after the previous one.
    last = 0.0
    for p in collected:
        while p["start"] <= last:
            p["start"] += 86400_000
        last = p["start"]
    collected.sort(key=lambda p: p["start"])
    # keep only the window the grid can display
    now_ms = datetime.now().timestamp() * 1000
    collected = [p for p in collected if now_ms - 3600_000 <= p["start"] <= now_ms + 26 * 3600_000]
    # stop = next programme start; final programme gets +30 min
    programmes = []
    for i, p in enumerate(collected):
        stop = collected[i + 1]["start"] if i + 1 < len(collected) else p["start"] + 30 * 60 * 1000
        programmes.append(
            {
                "title": p["title"],
                "desc": p.get("desc", ""),
                "start": int(p["start"]),
                "stop": int(stop),
            }
        )
    return programmes


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80]


def _build_payload() -> dict[str, Any]:
    sources = _load_sources()
    now = datetime.now()
    days = [now + timedelta(days=d) for d in range(DAYS_AHEAD)]
    channels: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_scrape_source, s, days): s for s in sources}
        for fut, source in futures.items():
            try:
                programmes = fut.result()
            except Exception as exc:  # noqa: BLE001
                log.warning("ivue scrape failed for %s: %s", source["name"], exc)
                programmes = []
            cid = f"ivue-{source['region'].lower()}-{_slug(source['name'])}"
            channels.append(
                {
                    "id": cid,
                    "name": source["name"],
                    "group": source["region_label"],
                    "language": "en",
                    "logo": source["logo"],
                    "url": "",
                    "region": source["region"],
                    "regionLabel": source["region_label"],
                    "tz": source["tz"],
                    "schedule": programmes,
                }
            )
    # keep only channels that produced at least one programme
    channels = [c for c in channels if c["schedule"]]
    channels.sort(key=lambda c: (c["regionLabel"], c["name"].lower()))
    return {"channels": channels, "count": len(channels)}


@ivue_router.get("/ivue")
def ivue_guide() -> dict[str, Any]:
    now = time.time()
    with _cache_lock:
        if _cache["payload"] and now - _cache["ts"] < CACHE_TTL:
            return _cache["payload"]
    payload = _build_payload()
    with _cache_lock:
        _cache["ts"] = now
        _cache["payload"] = payload
    return payload
