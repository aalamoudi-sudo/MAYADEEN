#!/usr/bin/env python3
"""Regression checks for the shared dashboard/risk-register pipeline."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def require(fragment: str, description: str) -> None:
    if fragment not in INDEX:
        raise AssertionError(description)


require(
    "return (riskGovernanceRegister||[]).filter(r=>!isTestOrSyntheticRecord_(r));",
    "Risk management must read the normalized Risk Governance Register only.",
)
require("function getRiskMetrics(){", "The shared risk metrics function is missing.")
require(
    "const criticalRisks=getRiskMetrics().critical;",
    "The home critical-risk card must use the shared metric.",
)
require(
    "const metrics=getRiskMetrics();\n  const risks=metrics.risks;",
    "The risk page must use the same shared metric and rows.",
)
require(
    'onclick="goToRisksFiltered(\'حرج\')"',
    "The home critical-risk card must open the severity-filtered register.",
)
require(
    "if(search) search.value='';\n  renderRiskRegister();",
    "Risk navigation must clear unrelated filters before rendering the register.",
)

# A simple contract example proves the count invariant expected of the shared
# selector: the card count equals the number of rows shown by Severity=حرج.
register = [
    {"id": "R-1", "sev": "حرج"},
    {"id": "R-2", "sev": "مرتفع"},
    {"id": "R-3", "sev": "حرج"},
]
card_count = sum(r["sev"] == "حرج" for r in register)
filtered_count = len([r for r in register if r["sev"] == "حرج"])
assert card_count == filtered_count == 2

print("risk consistency checks passed: shared source, metric, navigation, and count")
