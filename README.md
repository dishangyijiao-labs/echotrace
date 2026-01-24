# 语迹（EchoTrace）桌面版

本地语音转写与文本管理工具（Tauri + FastAPI + faster-whisper）。

## 产品概览

- 本地导入音视频 → 转写 → 时间轴 → 搜索 → 摘要 → 导出
- 本地数据库 SQLite + FTS5 全文搜索
- MCP 接入多模型（OpenAI / Claude / DeepSeek / 豆包 / 本地 LLM）

## 运行方式（推荐）

### 1) 启动 Core 与 Worker

```bash
cd apps/core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
python worker.py
```

### 2) 启动桌面应用

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## MCP 配置

- MCP provider 配置文件会被写入应用数据目录（`mcp-providers.json`）。
- 可在“模型与密钥”页面进行配置。
- 也可以用 `MCP_PROVIDERS_PATH` 指向自定义配置。

## 环境变量

- `ECHOTRACE_CORE_DIR`：Core 目录（默认 `../core`）
- `ECHOTRACE_PYTHON`：Python 可执行文件（默认 `python3` / Windows `python`）
- `MCP_PROVIDERS_PATH`：MCP provider 配置路径

## Legacy 目录

旧的 Web/Django 版本已迁移到 `legacy/`，仅用于参考，不建议继续使用。

## 相关文档

- `docs/ARCHITECTURE.md`
- `apps/core/README.md`
- `apps/desktop/README.md`
