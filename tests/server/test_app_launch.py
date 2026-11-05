from openjarvis.server import app_launch


def test_allowlist_requires_https_and_known_host():
    assert app_launch.is_allowed("https://www.google.com/chrome/")
    assert app_launch.is_allowed("https://discord.com/app")
    assert not app_launch.is_allowed("http://discord.com/app")
    assert not app_launch.is_allowed("https://evil.example.com/")
    assert not app_launch.is_allowed("https://emergent.sh/")


def test_native_match_uses_host_and_path_prefix():
    chrome = app_launch.match_native("https://www.google.com/chrome/")
    assert chrome is not None and chrome.exe == "chrome.exe"
    assert app_launch.match_native("https://www.google.com/search?q=x") is None
    assert app_launch.match_native("https://open.spotify.com/").scheme == "spotify"


def test_not_installed_for_unknown():
    assert app_launch.is_installed(None) is False
