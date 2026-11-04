"""Windows scripts must follow one pattern and reference real files."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BAT_FILES = ["run.bat", "install.bat", "build_exe.bat", "build_installers.bat"]
LOCAL_REF = re.compile(
    r"(?:scripts[\\/][\w./\\-]+\.(?:py|ps1)"
    r"|requirements[\w-]*\.txt"
    r"|config\.example\.json"
    r"|jarvis(?:_desktop)?\.py"
    r"|installer\.nsi)"
)


def _read(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8", errors="replace")


def test_scripts_start_quiet_and_run_from_their_own_folder():
    for name in BAT_FILES:
        text = _read(name)
        first = next(line for line in text.splitlines() if line.strip())
        assert first.strip().lower() == "@echo off", name
        assert 'cd /d "%~dp0"' in text, f"{name} must cd to its own folder"


def test_scripts_use_dot_venv_only():
    for name in BAT_FILES:
        text = _read(name)
        assert not re.search(r"(?<![.\w])env[\\/]Scripts", text), name


def test_referenced_files_exist():
    for name in BAT_FILES:
        for ref in set(LOCAL_REF.findall(_read(name))):
            assert (ROOT / ref.replace("\\", "/")).exists(), f"{name} -> {ref}"


def test_install_builds_the_web_ui_that_is_not_tracked():
    text = _read("install.bat")
    assert "server\\static\\index.html" in text
    assert "npm run build" in text


def test_windows_scripts_are_forced_to_crlf():
    attrs = _read(".gitattributes")
    for pattern in ("*.bat", "*.cmd", "*.nsi", "*.ps1"):
        assert f"{pattern} text eol=crlf" in attrs
    assert "*.sh text eol=lf" in attrs
