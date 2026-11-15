"""Gemini-powered AgroShift assistant."""

import json
import os
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from engine.knowledge_base import load_kb

load_dotenv()

SYSTEM_INSTRUCTION = """
You are the AgroShift Gambia agricultural decision-support assistant.

Your job is to explain AgroShift's documented crop knowledge, rotation
information, environmental evidence, and decision-support methodology.

STRICT RULES:
1. Base factual claims on the supplied AgroShift context.
2. Never invent crop traits, sources, measurements, scores, or recommendations.
3. Distinguish farmer-reported information, locally sourced evidence,
   regional/general sources, assumptions, and unknown information.
4. Explain that a cited source does not automatically mean a claim has been
   validated by an agronomist for the Manduar pilot.
5. Never present heuristic suitability scores as yield predictions,
   probabilities, or guarantees.
6. Environmental datasets are contextual evidence only. They are not used
   in the current strategy scoring calculations.
7. Do not claim to have measured a farmer's field or accessed live NASA data.
8. If information is missing or uncertain, say so clearly.
9. Do not prescribe pesticide use, chemical dosages, or precise planting
   decisions without reliable supporting information.
10. Encourage consultation with local agricultural extension officers
    for decisions requiring field-specific agronomic validation.

Be practical, clear, and concise. Explain technical terms simply.
"""

def answer_chat(
    message: str,
    history: list[dict[str, str]],
    field_id: str,
    evidence_summary: dict[str, Any],
) -> str:
    """Generate an AgroShift-grounded answer using Gemini."""

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Gemini API key is not configured.")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    kb = load_kb()

    context = {
        "project": "AgroShift Gambia",
        "pilot_field_id": field_id,
        "pilot_location": "Manduar, Brikama, The Gambia",
        "crop_knowledge": kb.crops,
        "source_records": kb.sources,
        "environmental_evidence_summary": evidence_summary,
        "important_methodology": [
            "Crop suitability comparisons are heuristic decision support.",
            "Scores are not yield predictions or probabilities.",
            "Environmental evidence is contextual and does not affect current scoring.",
            "Unknown traits are not treated as positive or negative evidence.",
            "Assumptions must not be presented as established facts.",
        ],
    }

    conversation = []

    for item in history[-10:]:
        role = item.get("role")
        content = item.get("content", "")

        if role in ("user", "assistant") and content:
            conversation.append(f"{role.upper()}: {content}")

    conversation.append(f"USER: {message}")

    prompt = (
        "AGROSHIFT PROJECT CONTEXT:\n"
        + json.dumps(context, ensure_ascii=False, default=str)
        + "\n\nCONVERSATION:\n"
        + "\n".join(conversation)
        + "\n\nRespond to the latest user message."
    )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
            ),
        )

        answer = response.text

        if not answer or not answer.strip():
            raise RuntimeError("Gemini returned an empty response.")

        return answer.strip()

    except Exception as exc:
        raise RuntimeError("Unable to generate a response from Gemini.") from exc
