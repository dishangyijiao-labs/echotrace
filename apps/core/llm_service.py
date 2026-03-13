"""
LLM summarization service — calls OpenAI-compatible APIs directly.

Supports: OpenAI, DeepSeek, Doubao, Claude, and local Ollama.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

# Provider configurations (replaces mcp_gateway/providers.json)
PROVIDERS: dict[str, dict] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o-mini", "gpt-4o", "o3-mini"],
        "api_key_env": "OPENAI_API_KEY",
    },
    "claude": {
        "models": ["claude-3-5-sonnet", "claude-3-5-haiku"],
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

_PROMPT_TEMPLATES: dict[str, str] = {
    "summary": "请对以下转录文本进行简洁的中文摘要，提炼核心观点和要点：\n\n{text}",
    "outline": "请将以下转录文本整理为结构化大纲（使用 Markdown 格式）：\n\n{text}",
    "action_items": "请从以下转录文本中提取待办事项和行动要点：\n\n{text}",
}


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
    model: str,
    text: str,
    prompt_type: str = "summary",
    **_kwargs: Any,
) -> str:
    """Generate a summary using the configured LLM provider."""
    cfg = PROVIDERS.get(provider_name)
    if not cfg:
        raise ValueError(f"Unknown provider: {provider_name}")

    template = _PROMPT_TEMPLATES.get(prompt_type, _PROMPT_TEMPLATES["summary"])
    truncated = text[:12000] if len(text) > 12000 else text
    prompt = template.format(text=truncated)

    api_key = _get_api_key(provider_name)

    if provider_name == "claude":
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set. Configure it in environment variables.")
        return await _call_claude(api_key, model, prompt)

    base_url = cfg.get("base_url")
    if not base_url:
        raise ValueError(f"No base_url configured for provider '{provider_name}'")

    if not api_key and provider_name != "local":
        env_name = cfg.get("api_key_env", f"{provider_name.upper()}_API_KEY")
        raise ValueError(f"API key not set. Set {env_name} in environment variables.")

    return await _call_openai_compatible(base_url, api_key, model, prompt)
