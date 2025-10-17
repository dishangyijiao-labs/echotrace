#!/usr/bin/env bash
set -euo pipefail

# Build and start frontend/backend stack
exec docker compose up --build backend frontend
