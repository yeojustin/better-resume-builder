"""
Gemini response_schema for structured resume JSON.
Shared by ingestion (parse) and analysis rendering features.
"""

GEMINI_RESUME_JSON_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "personalInfo": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "STRING"},
                "email": {"type": "STRING"},
                "phone": {"type": "STRING"},
                "location": {"type": "STRING"},
                "linkedin": {"type": "STRING"},
                "portfolio": {"type": "STRING"},
                "summary": {"type": "STRING"},
            },
        },
        "sections": {
            "type": "ARRAY",
            "description": "Dynamic structural array capturing all headings exactly as they appear in the PDF (e.g. 'Professional Experience', 'Projects', 'Hackathons', 'Education', 'Skills').",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "sectionTitle": {
                        "type": "STRING",
                        "description": "The exact header title of the section.",
                    },
                    "items": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "heading": {
                                    "type": "STRING",
                                    "description": "e.g., Job Title, Degree, Project Name, Skill Category",
                                },
                                "subheading": {
                                    "type": "STRING",
                                    "description": "e.g., Company, University, Client",
                                },
                                "date": {"type": "STRING"},
                                "location": {"type": "STRING"},
                                "bullets": {
                                    "type": "ARRAY",
                                    "items": {"type": "STRING"},
                                    "description": "Details, accomplishments, or comma separated list of skills.",
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "required": ["personalInfo", "sections"],
}
