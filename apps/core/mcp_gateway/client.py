from __future__ import annotations

from typing import Any

from mcp import ClientSession
from mcp.client.sse import sse_client
from mcp.client.stdio import StdioServerParameters, stdio_client


def _extract_text(content_blocks: list[Any]) -> str:
    texts = []
    for block in content_blocks:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            texts.append(block.text)
    return "\n".join(texts).strip()


def _build_arguments(payload: dict[str, Any], argument_map: dict[str, str] | None) -> dict[str, Any]:
    if not argument_map:
        return payload
    mapped = {}
    for key, value in payload.items():
        mapped_key = argument_map.get(key, key)
        mapped[mapped_key] = value
    return mapped


async def call_tool(provider: dict[str, Any], tool_name: str, payload: dict[str, Any]) -> dict[str, Any]:
    arguments = _build_arguments(payload, provider.get("argument_map"))

    if provider.get("type") == "sse":
        url = provider.get("url")
        if not url:
            raise ValueError("SSE provider requires url")
        async with sse_client(url) as streams:
            return await _call_with_session(streams, tool_name, arguments)

    command = provider.get("command")
    if not command:
        raise ValueError("Stdio provider requires command")
    server_params = StdioServerParameters(
        command=command,
        args=provider.get("args", []),
        env=provider.get("env"),
        cwd=provider.get("cwd"),
    )
    async with stdio_client(server_params) as streams:
        return await _call_with_session(streams, tool_name, arguments)


async def _call_with_session(streams, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    read_stream, write_stream = streams
    async with ClientSession(read_stream, write_stream) as session:
        await session.initialize()
        result = await session.call_tool(tool_name, arguments)
        if result.isError:
            raise RuntimeError("MCP tool returned error")
        if result.structuredContent is not None:
            return {"structured": result.structuredContent, "text": _extract_text(result.content)}
        return {"text": _extract_text(result.content)}
