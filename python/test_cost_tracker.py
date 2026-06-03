"""Tests for the Python side of the shared cost ledger.

Run from the python/ directory:
    python -m unittest test_cost_tracker
    # or, if pytest is installed:  pytest

Pins the cross-language contract: the record shape Python writes must match the
LedgerEntry shape the TypeScript cost-logger writes (src/cost/cost-logger.ts).
"""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path

import cost_tracker

# The exact fields the TS LedgerEntry defines — Python must emit the same keys.
LEDGER_FIELDS = {
    "timestamp",
    "date",
    "month",
    "service",
    "model",
    "units",
    "cost_per_unit",
    "total",
    "description",
    "project",
}


class CostTrackerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmpdir = tempfile.mkdtemp(prefix="cas-ledger-")
        self.ledger = Path(self.tmpdir) / "api-costs.json"
        os.environ["COST_LEDGER_PATH"] = str(self.ledger)

    def tearDown(self) -> None:
        os.environ.pop("COST_LEDGER_PATH", None)

    def _read(self) -> list[dict]:
        return json.loads(self.ledger.read_text(encoding="utf-8"))

    def test_logs_entry_with_ledger_field_shape(self) -> None:
        total = cost_tracker.log_cost("gemini", "imagen-4.0-ultra", 4, 0.06, "cover art", "proj")
        self.assertAlmostEqual(total, 0.24, places=6)

        entries = self._read()
        self.assertEqual(len(entries), 1)
        self.assertEqual(set(entries[0].keys()), LEDGER_FIELDS)
        self.assertEqual(entries[0]["service"], "gemini")
        self.assertEqual(entries[0]["project"], "proj")
        self.assertRegex(entries[0]["date"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertRegex(entries[0]["month"], r"^\d{4}-\d{2}$")

    def test_total_is_rounded_to_four_places(self) -> None:
        total = cost_tracker.log_cost("elevenlabs", "eleven_v3", 1000, 0.00022)
        self.assertAlmostEqual(total, 0.22, places=6)

    def test_appends_across_calls(self) -> None:
        cost_tracker.log_cost("a", "m", 1, 1.0)
        cost_tracker.log_cost("b", "m", 1, 2.0)
        self.assertEqual(len(self._read()), 2)

    def test_default_project_when_omitted(self) -> None:
        cost_tracker.log_cost("gemini", "m", 1, 0.01)
        self.assertEqual(self._read()[0]["project"], cost_tracker.DEFAULT_PROJECT)


if __name__ == "__main__":
    unittest.main()
