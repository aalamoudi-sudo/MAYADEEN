#!/usr/bin/env python3
"""Build the paste-ready Apps Script artifact from its canonical sources."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "apps-script" / "Code.gs"
INQUIRIES = ROOT / "apps-script" / "Inquiries.gs"
OUTPUT = ROOT / "apps-script" / "current-apps-script.gs"
SEPARATOR = "\n\n// Bundled inquiry module. Source: apps-script/Inquiries.gs\n"


def main() -> None:
    OUTPUT.write_text(
        CORE.read_text(encoding="utf-8")
        + SEPARATOR
        + INQUIRIES.read_text(encoding="utf-8"),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
