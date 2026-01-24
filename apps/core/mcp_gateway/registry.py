from __future__ import annotations

import json
import os
from pathlib import Path

DEFAULT_PROVIDERS_PATH = Path(__file__).with_name("providers.json")


def load_providers() -> dict:
    providers_path = Path(os.environ.get("MCP_PROVIDERS_PATH", DEFAULT_PROVIDERS_PATH))
    if not providers_path.exists():
        raise FileNotFoundError(f"Providers file not found: {providers_path}")
    return json.loads(providers_path.read_text(encoding="utf-8"))
