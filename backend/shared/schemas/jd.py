"""Gemini response_schema for structured job description JSON."""

GEMINI_JD_JSON_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING", "description": "Job title if stated."},
        "company": {"type": "STRING"},
        "location": {"type": "STRING"},
        "employmentType": {"type": "STRING"},
        "summary": {"type": "STRING", "description": "One short paragraph summarizing the role."},
        "sections": {
            "type": "ARRAY",
            "description": "Logical sections as they appear (Overview, Responsibilities, Requirements, etc.).",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "title": {"type": "STRING"},
                    "body": {"type": "STRING", "description": "Plain text for this section."},
                },
                "required": ["title", "body"],
            },
        },
        "mustHaveKeywords": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "Hard skills, tools, credentials explicitly required.",
        },
        "niceToHaveKeywords": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        },
    },
    "required": ["sections", "mustHaveKeywords", "niceToHaveKeywords"],
}
