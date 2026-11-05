"""Open allow-listed services in their installed desktop app, else the website."""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


@dataclass(frozen=True)
class NativeApp:
    host: str
    path_prefix: str = "/"
    scheme: str = ""  # URL scheme the desktop app registers with Windows
    launch_uri: str = ""  # URI that starts the app
    exe: str = ""  # executable name for apps without a URL scheme
    exe_paths: tuple[str, ...] = ()  # candidate install paths (env vars allowed)


def _scheme(host: str, scheme: str, uri: str, prefix: str = "/") -> NativeApp:
    return NativeApp(host, prefix, scheme=scheme, launch_uri=uri)


def _exe(host: str, prefix: str, exe: str, *paths: str) -> NativeApp:
    return NativeApp(host, prefix, exe=exe, exe_paths=paths)


# Most specific entries first; matching is by host and path prefix.
NATIVE_APPS: tuple[NativeApp, ...] = (
    _scheme("open.spotify.com", "spotify", "spotify:"),
    _scheme("listen.tidal.com", "tidal", "tidal://"),
    _scheme("music.apple.com", "music", "music://"),
    _scheme("music.amazon.com", "amazonmusic", "amazonmusic://"),
    _scheme("www.deezer.com", "deezer", "deezer://"),
    _scheme("www.audible.com", "audible", "audible://"),
    _scheme("store.steampowered.com", "steam", "steam://store"),
    _scheme("steamcommunity.com", "steam", "steam://open/main"),
    _scheme(
        "store.epicgames.com",
        "com.epicgames.launcher",
        "com.epicgames.launcher://store",
    ),
    _scheme("www.gog.com", "goggalaxy", "goggalaxy://"),
    _scheme("discord.com", "discord", "discord://"),
    _scheme("web.telegram.org", "tg", "tg://"),
    _scheme("web.whatsapp.com", "whatsapp", "whatsapp://"),
    _scheme("slack.com", "slack", "slack://open"),
    _scheme("www.twitch.tv", "twitch", "twitch://"),
    _scheme("app.plex.tv", "plex", "plex://"),
    _scheme("www.netflix.com", "netflix", "netflix:"),
    _scheme("anydesk.com", "anydesk", "anydesk:"),
    _scheme("www.teamviewer.com", "teamviewer10", "teamviewer10://"),
    _scheme("rustdesk.com", "rustdesk", "rustdesk://"),
    _scheme("parsec.app", "parsec", "parsec://"),
    _exe(
        "www.videolan.org",
        "/vlc",
        "vlc.exe",
        r"%ProgramFiles%\VideoLAN\VLC\vlc.exe",
        r"%ProgramFiles(x86)%\VideoLAN\VLC\vlc.exe",
    ),
    _exe(
        "www.google.com",
        "/chrome",
        "chrome.exe",
        r"%ProgramFiles%\Google\Chrome\Application\chrome.exe",
        r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe",
        r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
    ),
    _exe(
        "www.microsoft.com",
        "/edge",
        "msedge.exe",
        r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe",
        r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe",
    ),
    _exe(
        "www.mozilla.org",
        "/firefox",
        "firefox.exe",
        r"%ProgramFiles%\Mozilla Firefox\firefox.exe",
        r"%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe",
    ),
    _exe(
        "brave.com",
        "/",
        "brave.exe",
        r"%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe",
        r"%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe",
    ),
    _exe(
        "www.opera.com",
        "/",
        "opera.exe",
        r"%LOCALAPPDATA%\Programs\Opera\opera.exe",
        r"%ProgramFiles%\Opera\opera.exe",
    ),
    _exe(
        "vivaldi.com",
        "/",
        "vivaldi.exe",
        r"%LOCALAPPDATA%\Vivaldi\Application\vivaldi.exe",
        r"%ProgramFiles%\Vivaldi\Application\vivaldi.exe",
    ),
    _exe(
        "www.torproject.org",
        "/",
        "firefox.exe",
        r"%USERPROFILE%\Desktop\Tor Browser\Browser\firefox.exe",
    ),
)

_EXTRA_HOSTS = {
    "music.youtube.com",
    "soundcloud.com",
    "www.pandora.com",
    "bandcamp.com",
    "play.qobuz.com",
    "www.mixcloud.com",
    "archive.org",
    "www.humblebundle.com",
    "isthereanydeal.com",
    "www.reddit.com",
    "www.youtube.com",
    "x.com",
    "news.ycombinator.com",
    "aistudio.google.com",
    "base44.com",
    "cloud.atlascloud.ai",
    "console.anthropic.com",
    "copilot.microsoft.com",
    "dashboard.twitch.tv",
    "gaming.amazon.com",
    "gg.deals",
    "itch.io",
    "kick.com",
    "livecenter.tiktok.com",
    "luna.amazon.com",
    "obsproject.com",
    "openrouter.ai",
    "platform.openai.com",
    "play.geforcenow.com",
    "playnite.link",
    "prismlauncher.org",
    "prismlive.com",
    "remotedesktop.google.com",
    "rumble.com",
    "store.playstation.com",
    "streamlabs.com",
    "streamyard.com",
    "studio.youtube.com",
    "ubisoftconnect.com",
    "www.blizzard.com",
    "www.crave.ca",
    "www.crunchyroll.com",
    "www.disneyplus.com",
    "www.ea.com",
    "www.facebook.com",
    "www.hulu.com",
    "www.instagram.com",
    "www.max.com",
    "www.paramountplus.com",
    "www.peacocktv.com",
    "www.primevideo.com",
    "www.riotgames.com",
    "www.rockstargames.com",
    "www.tiktok.com",
    "www.xbox.com",
    "www.xmltv.org",
    "discord.com",
    "www.netflix.com",
}

LINK_HOSTS: frozenset[str] = frozenset(_EXTRA_HOSTS | {a.host for a in NATIVE_APPS})


def is_allowed(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme == "https" and parsed.hostname in LINK_HOSTS


def match_native(url: str) -> NativeApp | None:
    parsed = urlparse(url)
    for app in NATIVE_APPS:
        if parsed.hostname == app.host and parsed.path.startswith(app.path_prefix):
            return app
    return None


def _scheme_registered(scheme: str) -> bool:
    import winreg

    try:
        with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, scheme) as key:
            winreg.QueryValueEx(key, "URL Protocol")
        return True
    except OSError:
        return False


def _find_exe(app: NativeApp) -> str | None:
    import winreg

    for root in (winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER):
        key_path = rf"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\{app.exe}"
        try:
            with winreg.OpenKey(root, key_path) as key:
                value = winreg.QueryValueEx(key, None)[0]
            if value and Path(value.strip('"')).is_file():
                return value.strip('"')
        except OSError:
            continue
    for candidate in app.exe_paths:
        path = os.path.expandvars(candidate)
        if Path(path).is_file():
            return path
    return None


def is_installed(app: NativeApp | None) -> bool:
    if app is None or sys.platform != "win32":
        return False
    if app.scheme:
        return _scheme_registered(app.scheme)
    return _find_exe(app) is not None


def launch_native(app: NativeApp) -> bool:
    """Start the installed desktop app. Returns False if it could not start."""
    try:
        if app.scheme:
            os.startfile(app.launch_uri)  # type: ignore[attr-defined]
            return True
        exe = _find_exe(app)
        if exe:
            subprocess.Popen([exe], close_fds=True)
            return True
    except OSError:
        pass
    return False
