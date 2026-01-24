# EchoTrace 桌面版安装与排错

## 运行

```bash
cd apps/core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
python worker.py
```

```bash
cd apps/desktop
npm install
npm run tauri dev
```

## 环境变量

- `ECHOTRACE_CORE_DIR`：Core 目录（默认 `../core`）
- `ECHOTRACE_PYTHON`：Python 可执行文件
- `MCP_PROVIDERS_PATH`：MCP 配置文件路径

## 常见问题

- 启动失败：确认 `ffmpeg` 在 PATH 中。
- 摘要失败：确认 MCP provider 配置已填写 API key。
- 无音频播放：确认媒体文件路径存在且未移动。
