"""Minimal Gemini schema: grounded line edits + short section scores only."""

GEMINI_DEEP_ANALYSIS_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "fit_score_llm": {
            "type": "INTEGER",
            "description": (
                "0–100 STRICT holistic fit vs this JD only. Calibrate hard: 90+ rare (near-perfect alignment); "
                "strong candidates often 62–80; missing must-have themes/tools → below 55. Use evidence in the JSON only."
            ),
        },
        "section_rankings": {
            "type": "ARRAY",
            "description": "One row per major section in the resume JSON; section_title must match resume sectionTitle exactly when possible.",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "section_title": {"type": "STRING"},
                    "relevance_score": {
                        "type": "INTEGER",
                        "description": "0–100 STRICT: how well this section supports this JD (same calibration as fit_score_llm).",
                    },
                    "comment": {
                        "type": "STRING",
                        "description": "At most 12 words. One concrete gap or win.",
                    },
                },
                "required": ["section_title", "relevance_score", "comment"],
            },
        },
        "line_edits": {
            "type": "ARRAY",
            "description": (
                "Propose edits wherever JD-aligned wording would improve fit (keywords, outcomes, tools the JD stresses). "
                "'before' must be copied verbatim from the resume JSON. 'after' improves clarity or JD alignment without new facts. "
                "If fit is already strong, fewer edits is fine; do not omit useful JD-fit improvements to keep the array empty."
            ),
            "items": {
                "type": "OBJECT",
                "properties": {
                    "section_title": {"type": "STRING"},
                    "before": {"type": "STRING", "description": "Exact substring from the resume JSON."},
                    "after": {"type": "STRING", "description": "Replacement text only."},
                    "note": {
                        "type": "STRING",
                        "description": "Optional. Max 14 words. Empty string if none.",
                    },
                },
                "required": ["section_title", "before", "after", "note"],
            },
        },
        "section_review": {
            "type": "ARRAY",
            "description": (
                "One row per resume section: use exact sections[].sectionTitle, and one row with section_title "
                "exactly 'Contact & summary' if personalInfo has any filled field. Explain briefly even when no edits."
            ),
            "items": {
                "type": "OBJECT",
                "properties": {
                    "section_title": {"type": "STRING"},
                    "has_suggested_edits": {"type": "BOOLEAN"},
                    "why": {
                        "type": "STRING",
                        "description": "Max 22 words. Why this section is fine or what is missing vs the JD.",
                    },
                },
                "required": ["section_title", "has_suggested_edits", "why"],
            },
        },
        "jd_keywords": {
            "type": "ARRAY",
            "description": (
                "Extract 12–45 distinct, concrete keywords/phrases from the job description only: skills, tools, "
                "frameworks, domains, certifications, seniority signals. Lowercase, no full sentences."
            ),
            "items": {"type": "STRING"},
        },
        "resume_keywords": {
            "type": "ARRAY",
            "description": (
                "Extract 12–45 distinct keywords/phrases implied by the structured Resume JSON (skills, tools, roles, domains). "
                "Lowercase, no invention beyond the resume."
            ),
            "items": {"type": "STRING"},
        },
    },
    "required": [
        "fit_score_llm",
        "section_rankings",
        "line_edits",
        "section_review",
        "jd_keywords",
        "resume_keywords",
    ],
}
