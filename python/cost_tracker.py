"""Shared cost ledger — Python side.

Reads/writes the SAME JSON file as the TypeScript cost-logger (see
src/cost/cost-logger.ts), so a Python CLI script and a TypeScript service can
record spend to one ledger without a database. The ledger RECORD SHAPE matches
field-for-field (same keys + types); the per-provider pricing tables below are
the Python side only and are not shared with the TypeScript pricing module.

Ledger location resolution order:
  1. COST_LEDGER_PATH env var
  2. ./data/api-costs.json relative to the current working directory
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

# Per-unit USD rates, mirrored from src/cost/pricing.ts.
# Imagen: per image. ElevenLabs: per character.
PRICING = {
    "gemini": {
        "imagen-4.0-ultra-generate-001": 0.06,
        "imagen-4.0-generate-001": 0.04,
        "imagen-4.0-fast-generate-001": 0.02,
        "imagen-4.0-ultra": 0.06,
        "imagen-4.0-standard": 0.04,
        "imagen-4.0-fast": 0.02,
    },
    "elevenlabs": {
        "eleven_multilingual_v2": 0.00022,
        "eleven_v3": 0.00022,
    },
}

DEFAULT_PROJECT = "creative-ai-suite"


def ledger_path() -> Path:
    env = os.environ.get("COST_LEDGER_PATH")
    if env:
        return Path(env)
    return Path.cwd() / "data" / "api-costs.json"


def _load() -> list[dict]:
    p = ledger_path()
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save(entries: list[dict]) -> None:
    p = ledger_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(entries, indent=2), encoding="utf-8")


def log_cost(
    service: str,
    model: str,
    units: float,
    cost_per_unit: float,
    description: str = "",
    project: str = DEFAULT_PROJECT,
) -> float:
    """Append one cost entry; return its rounded total in USD."""
    total = round(units * cost_per_unit, 4)
    now = datetime.now(timezone.utc)
    iso = now.isoformat()
    entry = {
        "timestamp": iso,
        "date": iso[:10],
        "month": iso[:7],
        "service": service,
        "model": model,
        "units": units,
        "cost_per_unit": cost_per_unit,
        "total": total,
        "description": description[:200],
        "project": project,
    }
    ledger = _load()
    ledger.append(entry)
    _save(ledger)
    return total
