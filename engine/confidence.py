"""Confidence rules. Confidence describes how well supported a comparison is, not how likely success is.

Levels: low, moderate, high. 'high' is deliberately unreachable in the pilot: it needs an agronomist review,
at least three farmers, at least 85% of key traits sourced, no unconfirmed crops and no missing farmer inputs.
"""
from __future__ import annotations

from engine.knowledge_base import KnowledgeBase, SCORED_TRAITS, SUPPORTED


def trait_support(cycle: list[str], kb: KnowledgeBase) -> tuple[float, list[str]]:
    items = [(c, t) for c in dict.fromkeys(cycle) for t in SCORED_TRAITS]
    weak = [f"{c}: {t.replace('_', ' ')} ({kb.trait(c, t)['trait_status']})" for c, t in items if kb.trait(c, t)["trait_status"] not in SUPPORTED]
    share = 1 - len(weak) / len(items)
    return share, weak


def assess_confidence(cycle, kb, evidence_base, unconfirmed, input_gaps_count, is_reference=False):
    share, weak = trait_support(cycle, kb)
    farmers = int(evidence_base.get("farmers_interviewed") or 0)
    reasons = []
    level = "moderate"
    if share < 0.7:
        level = "low"; reasons.append(f"only {share:.0%} of the crop traits used have a source or farmer report")
    if unconfirmed:
        level = "low"; reasons.append("crop availability is not confirmed locally: " + ", ".join(unconfirmed))
    if farmers < 3 and not is_reference:
        level = "low"; reasons.append(f"the option is untested locally ({farmers} farmer interviewed)")
    if input_gaps_count >= 4:
        level = "low"; reasons.append("several farmer inputs are missing")
    if (level == "moderate" and evidence_base.get("agronomist_reviewed") is True and farmers >= 3 and share >= 0.85
            and not unconfirmed and input_gaps_count == 0):
        level = "high"; reasons.append("agronomist-reviewed traits, three or more farmers and complete inputs")
    reasons.append("rainfall products disagree on dry spells, so rainfall-based evidence is capped at moderate confidence")
    return {"level": level, "reasons": reasons, "trait_support_share": round(share, 2)}, weak
