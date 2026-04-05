import json
import logging

from fastapi import HTTPException
from google.genai import types
from pydantic import BaseModel
from shared.client_factory import get_gemini_client

from shared.schemas.resume import GEMINI_RESUME_JSON_SCHEMA

logger = logging.getLogger(__name__)


class OptimizeRequest(BaseModel):
    master_cv: dict
    job_description: str


OPTIMIZATION_RESPONSE_SCHEMA: dict = {
    "type": "OBJECT",
    "properties": {
        "tailored_cv": GEMINI_RESUME_JSON_SCHEMA,
        "analytics": {
            "type": "OBJECT",
            "properties": {
                "match_percentage": {
                    "type": "INTEGER",
                    "description": "ATS Match score from 0 to 100",
                },
                "detected_keywords": {"type": "ARRAY", "items": {"type": "STRING"}},
                "missing_keywords": {"type": "ARRAY", "items": {"type": "STRING"}},
                "feedback_by_section": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "section": {"type": "STRING"},
                            "advice": {"type": "STRING"},
                        },
                    },
                },
            },
        },
    },
    "required": ["tailored_cv", "analytics"],
}


async def optimize_cv_against_jd(
    *, master_cv: dict, job_description: str, gemini_api_key: str | None = None
) -> dict:
    logger.info("Optimization: running ATS JD optimization (JSON pipeline)")
    try:
        client = get_gemini_client(gemini_api_key)
        prompt = f"""You are an elite Career Strategist and ATS Expert.
Your goal is to optimize the provided Master CV (in JSON format) against the Job Description.

REQUIREMENTS:
1. Rewrite the CV's experience or project bullets to better match the exact keywords and tone of the JD.
2. Return the exact same JSON structure for the newly tailored CV, keeping personal Info, education, headings, and non-bullet elements intact except where optimization is needed in the bullet arrays.
3. Perform an ATS Keyword Analysis and give a Match Percentage (0-100).
4. Provide constructive feedback on what was changed or what remains weak.

Respond ONLY with a valid JSON object matching this schema. NO markdown wrapping.

Master CV JSON:
{json.dumps(master_cv)}

Job Description:
{job_description}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=OPTIMIZATION_RESPONSE_SCHEMA,
                temperature=0.2,
            ),
        )
        result_data = json.loads(response.text)
        logger.info(
            "Optimization complete. Match rate: %s%%",
            result_data.get("analytics", {}).get("match_percentage"),
        )
        return result_data
    except Exception as e:
        logger.exception("Optimizer service error")
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=429,
                detail="Gemini API rate limit reached. Please wait a moment and try again.",
            ) from e
        raise HTTPException(status_code=500, detail=err_str) from e
