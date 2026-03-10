"""LLM client for Foundation Model API via OpenAI-compatible interface."""

import os
import json
import logging
from openai import OpenAI
from .config import get_config

logger = logging.getLogger("midas.llm")


def get_llm_client() -> OpenAI:
    cfg = get_config()
    headers = cfg.authenticate()
    bearer = headers.get("Authorization", "").replace("Bearer ", "")
    host = cfg.host.rstrip("/")
    base = host if host.startswith("https://") else f"https://{host}"
    return OpenAI(
        api_key=bearer,
        base_url=f"{base}/serving-endpoints",
    )


def generate_table_metadata(
    table_name: str,
    columns: list[dict],
    sample_rows: list[dict],
    column_stats: list[dict],
    row_count: int,
    user_context: str = "",
) -> dict:
    model = os.environ.get("SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")
    client = get_llm_client()

    columns_info = "\n".join(
        f"- {c['name']} ({c['type']}): {c.get('distinct_count', '?')} distinct, "
        f"{c.get('null_pct', '?')}% null, samples: {c.get('sample_values', [])}"
        for c in column_stats
    )

    sample_str = json.dumps(sample_rows[:5], indent=2, default=str) if sample_rows else "No samples"

    prompt = f"""You are a metadata expert for Databricks Unity Catalog. Generate concise, Genie-optimized metadata for the table below.

TABLE: {table_name}
ROW COUNT: {row_count}
USER CONTEXT: {user_context or 'None provided'}

COLUMNS:
{columns_info}

SAMPLE ROWS:
{sample_str}

Generate a JSON response with:
1. "table_comment": A 1-2 sentence description of what this table contains. Reference specific data patterns you observe.
2. "columns": An object where each key is a column name and the value is an object with:
   - "description": A concise description (1 sentence) that helps Genie understand the column's meaning, typical values, and business context.

Focus on being specific to the actual data patterns. Mention value ranges, common categories, and business meaning.
Return ONLY valid JSON, no markdown fences."""

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4096,
        temperature=0.3,
    )

    text = response.choices[0].message.content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(text)
