"""
LLM summarization service — calls OpenAI-compatible APIs directly.

Supports: OpenAI, DeepSeek, Doubao, Claude, and local Ollama.

Structured output:
- "summary" prompt_type → plain text summary
- "outline" prompt_type → JSON with sections/subsections structure
- "action_items" prompt_type → JSON with action items list
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Structured output schemas (Pydantic models)
# ---------------------------------------------------------------------------


class OutlineSection(BaseModel):
    """大纲中的一个章节"""
    title: str = Field(description="章节标题")
    key_points: list[str] = Field(default_factory=list, description="该章节的要点列表")
    subsections: list[OutlineSection] = Field(default_factory=list, description="子章节")


class OutlineResult(BaseModel):
    """结构化大纲输出"""
    title: str = Field(description="整体标题")
    sections: list[OutlineSection] = Field(description="大纲章节列表")


class ActionItem(BaseModel):
    """一个行动要点"""
    task: str = Field(description="待办事项描述")
    priority: str = Field(default="medium", description="优先级: high/medium/low")
    context: str = Field(default="", description="相关上下文或出处片段")


class ActionItemsResult(BaseModel):
    """结构化行动要点输出"""
    items: list[ActionItem] = Field(description="行动要点列表")


# Map prompt_type to its Pydantic model (None = plain text)
_STRUCTURED_MODELS: dict[str, type[BaseModel] | None] = {
    "summary": None,
    "outline": OutlineResult,
    "action_items": ActionItemsResult,
}


# ---------------------------------------------------------------------------
# Provider configurations
# ---------------------------------------------------------------------------

PROVIDERS: dict[str, dict] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o-mini", "gpt-4o", "o3-mini"],
        "api_key_env": "OPENAI_API_KEY",
    },
    "claude": {
        "models": ["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
        "api_key_env": "ANTHROPIC_API_KEY",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "models": ["deepseek-chat", "deepseek-reasoner"],
        "api_key_env": "DEEPSEEK_API_KEY",
    },
    "doubao": {
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "models": ["doubao-pro-128k", "doubao-lite-32k"],
        "api_key_env": "DOUBAO_API_KEY",
    },
    "local": {
        "base_url": "http://127.0.0.1:11434/v1",
        "models": ["qwen2.5:7b", "llama3.1:8b"],
    },
}

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------

_PROMPT_TEMPLATES: dict[str, str] = {
    "summary": "请对以下转录文本进行简洁的中文摘要，提炼核心观点和要点：\n\n{text}",
    "outline": (
        "请将以下转录文本整理为结构化大纲。\n\n"
        "你必须严格以 JSON 格式输出，不要输出任何其他内容。JSON 格式如下：\n"
        '{{"title": "整体标题", "sections": [{{"title": "章节标题", "key_points": ["要点1", "要点2"], "subsections": []}}]}}\n\n'
        "转录文本：\n{text}"
    ),
    "action_items": (
        "请从以下转录文本中提取待办事项和行动要点。\n\n"
        "你必须严格以 JSON 格式输出，不要输出任何其他内容。JSON 格式如下：\n"
        '{{"items": [{{"task": "待办事项描述", "priority": "high/medium/low", "context": "相关上下文"}}]}}\n\n'
        "转录文本：\n{text}"
    ),
}


# ---------------------------------------------------------------------------
# API callers
# ---------------------------------------------------------------------------


def _get_api_key(provider_name: str) -> str:
    """Resolve API key from environment variables."""
    cfg = PROVIDERS.get(provider_name, {})
    env_name = cfg.get("api_key_env")
    if env_name:
        return os.environ.get(env_name, "")
    return ""


async def _call_openai_compatible(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    *,
    json_mode: bool = False,
) -> str:
    """Call an OpenAI-compatible chat completions endpoint."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body: dict[str, Any] = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 2048,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise ValueError(f"LLM returned empty choices: {data}")
        text = choices[0]["message"].get("content")
        if not text:
            raise ValueError(f"LLM returned null content: {data}")
        return text.strip()


async def _call_claude(api_key: str, model: str, prompt: str) -> str:
    """Call the Anthropic Messages API."""
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    body = {
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data.get("content") or []
        if not content:
            raise ValueError(f"Claude returned empty content: {data}")
        text = content[0].get("text")
        if not text:
            raise ValueError(f"Claude returned non-text content block: {data}")
        return text.strip()


# ---------------------------------------------------------------------------
# JSON parsing & validation
# ---------------------------------------------------------------------------


def _extract_json(raw: str) -> str:
    """Extract JSON from LLM response that may contain markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        # Strip ```json ... ``` wrapper
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        start = 1
        end = len(lines)
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip().startswith("```"):
                end = i
                break
        text = "\n".join(lines[start:end]).strip()
    return text


def parse_structured_output(raw_text: str, prompt_type: str) -> dict[str, Any] | str:
    """
    Parse and validate LLM output against the expected schema.

    For "summary" type, returns the raw string.
    For structured types, parses JSON and validates with Pydantic.
    Falls back to raw text wrapped in a dict on parse failure.
    """
    model_cls = _STRUCTURED_MODELS.get(prompt_type)
    if model_cls is None:
        return raw_text

    try:
        json_str = _extract_json(raw_text)
        data = json.loads(json_str)
        validated = model_cls.model_validate(data)
        return validated.model_dump()
    except (json.JSONDecodeError, ValueError):
        # Fallback: return raw text so the caller always gets something useful
        return {"raw": raw_text, "_parse_error": True}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def llm_summarize(
    provider_name: str,
    model: str,
    text: str,
    prompt_type: str = "summary",
    **_kwargs: Any,
) -> dict[str, Any] | str:
    """
    Generate a summary/outline/action-items using the configured LLM provider.

    Returns:
        - str for "summary" prompt_type
        - dict for "outline" / "action_items" (validated structured output)
    """
    cfg = PROVIDERS.get(provider_name)
    if not cfg:
        raise ValueError(f"Unknown provider: {provider_name}")

    template = _PROMPT_TEMPLATES.get(prompt_type, _PROMPT_TEMPLATES["summary"])
    truncated = text[:12000] if len(text) > 12000 else text
    prompt = template.format(text=truncated)

    api_key = _get_api_key(provider_name)
    use_json_mode = prompt_type in ("outline", "action_items")

    if provider_name == "claude":
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set. Configure it in environment variables.")
        raw = await _call_claude(api_key, model, prompt)
    else:
        base_url = cfg.get("base_url")
        if not base_url:
            raise ValueError(f"No base_url configured for provider '{provider_name}'")

        if not api_key and provider_name != "local":
            env_name = cfg.get("api_key_env", f"{provider_name.upper()}_API_KEY")
            raise ValueError(f"API key not set. Set {env_name} in environment variables.")

        raw = await _call_openai_compatible(base_url, api_key, model, prompt, json_mode=use_json_mode)

    return parse_structured_output(raw, prompt_type)
