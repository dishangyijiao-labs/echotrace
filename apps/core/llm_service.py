"""
LLM summarization service — calls OpenAI-compatible APIs directly.

Supports: OpenAI, DeepSeek, Doubao, Claude, and local Ollama.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

# Base URLs for known providers
_BASE_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "doubao": "https://ark.cn-beijing.volces.com/api/v3",
    "local": "http://127.0.0.1:11434/v1",
}

# Environment variable names for API keys
_API_KEY_ENV: dict[str, str] = {
    "openai": "OPENAI_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
    "doubao": "DOUBAO_API_KEY",
}

_PROMPT_TEMPLATES: dict[str, str] = {
    "summary": "请对以下转录文本进行简洁的中文摘要，提炼核心观点和要点：\n\n{text}",
    "outline": "请将以下转录文本整理为结构化大纲（使用 Markdown 格式）：\n\n{text}",
    "action_items": "请从以下转录文本中提取待办事项和行动要点：\n\n{text}",
}


def _get_api_key(provider_name: str, provider_config: dict[str, Any]) -> str:
    """Resolve API key from provider config env, or well-known env vars."""
    # Check provider-specific env overrides in config
    env_map = provider_config.get("env") or {}
    for key, val in env_map.items():
        if "key" in key.lower() and val:
            return val

    # Fallback to well-known env vars
    env_name = _API_KEY_ENV.get(provider_name)
    if env_name:
        key = os.environ.get(env_name, "")
        if key:
            return key

    return ""


async def _call_openai_compatible(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
) -> str:
    """Call an OpenAI-compatible chat completions endpoint."""
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 2048,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{base_url}/chat/completions",
            json=body,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


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
        return data["content"][0]["text"].strip()


async def llm_summarize(
    provider_name: str,
    provider_config: dict[str, Any],
    model: str,
    text: str,
    prompt_type: str = "summary",
) -> str:
    """
    Generate a summary using the configured LLM provider.

    Args:
        provider_name: e.g. "deepseek", "openai", "claude", "doubao", "local"
        provider_config: provider entry from mcp-providers.json
        model: model name
        text: transcript text to summarize
        prompt_type: "summary" | "outline" | "action_items"

    Returns:
        Generated summary text.
    """
    template = _PROMPT_TEMPLATES.get(prompt_type, _PROMPT_TEMPLATES["summary"])
    # Truncate very long texts to avoid token limits
    truncated = text[:12000] if len(text) > 12000 else text
    prompt = template.format(text=truncated)

    api_key = _get_api_key(provider_name, provider_config)

    if provider_name == "claude":
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set. Configure it in environment variables.")
        return await _call_claude(api_key, model, prompt)

    # All other providers use OpenAI-compatible API
    base_url = provider_config.get("base_url") or _BASE_URLS.get(provider_name)
    if not base_url:
        raise ValueError(f"No base_url configured for provider '{provider_name}'")

    if not api_key and provider_name not in ("local",):
        env_name = _API_KEY_ENV.get(provider_name, f"{provider_name.upper()}_API_KEY")
        raise ValueError(f"API key not set. Set {env_name} in environment variables.")

    return await _call_openai_compatible(base_url, api_key, model, prompt)
