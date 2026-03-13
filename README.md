# EchoTrace

**"我记得某个视频里提过这件事，但到底是哪一段？"**

EchoTrace 帮你把音视频文件转成可搜索的文字，在几秒内定位到任意一句话。完全本地运行，数据不离开你的电脑。

## 谁需要它？

| 角色 | 场景 |
|------|------|
| 短视频团队 | 从几十条长视频里找到所有提到某个话题的片段，批量切片 |
| 播客主播 | 回溯往期节目："我第几期聊过 XX？" |
| 记者 / 研究者 | 在大量采访录音中按关键词检索证据 |
| 律师 / 合规 | 从庭审录音、会议录音中快速提取关键陈述 |
| 课程制作者 | 定位课程视频中的知识点，生成字幕 |

### Before / After

```
任务：从 50 条长视频中找出所有关于 "人工智能" 的片段

手动翻看：~2 小时
EchoTrace：~10 秒
  1. 搜索 "人工智能"
  2. 看到所有命中结果 + 时间戳
  3. 点击跳转播放 → 确认 → 导出
```

## 核心功能

### 本地转录
- 基于 OpenAI Whisper，6 种模型可选（tiny → large-v3），按精度和速度自由取舍
- 支持 MP3 / WAV / MP4 / MOV / MKV / AVI / FLAC 等主流格式，单文件最大 10 GB
- 拖拽导入，批量提交，后台队列处理，转录完成系统通知

### 搜索
- **关键词搜索** — SQLite FTS5 全文检索，毫秒级响应
- **语义搜索** — 基于向量嵌入，用自然语言描述你想找的内容（"那段关于创业失败的反思"）
- **混合模式** — 关键词 + 语义同时检索，结果按相关性排序
- 高级筛选：日期范围、时长、语言、文件类型、排序方式

### AI 分析（可选）
- 接入 GPT-4o / Claude / DeepSeek / Ollama 等大模型
- 智能摘要：一键总结整段录音的核心内容
- 跨文件问答："这几期节目里嘉宾对 XX 话题有哪些不同观点？"

### 播放与导出
- 内置播放器，点击搜索结果直接跳转到对应时间戳
- 逐句同步高亮，支持变速播放（0.5x ~ 2.0x）、单句循环
- 导出格式：TXT / SRT 字幕 / Markdown，支持批量导出 ZIP

### 隐私
- 100% 本地处理，不上传任何数据
- 无账号、无遥测、无追踪
- 断网也能用（AI 分析除外）

## 快速开始

### 环境要求

- Python 3.12
- Node.js 20+
- FFmpeg

### 安装与运行

```bash
# 1. 配置 Python 环境
./setup-python-env.sh

# 2. 打包桌面应用
cd apps/desktop
./rebuild-package.sh

# 3. 启动
open src-tauri/target/release/bundle/macos/EchoTrace.app
```

应用启动后会自动运行后端服务，无需手动启动。首次使用会引导你下载 Whisper 模型。

## 技术架构

| 层 | 技术 |
|----|------|
| 桌面壳 | Tauri 2.0 (Rust) |
| 前端 | React + TailwindCSS + i18next |
| 后端 API | FastAPI (Python) |
| 转录引擎 | faster-whisper + FFmpeg |
| 数据库 | SQLite + FTS5 |
| AI / RAG | LangChain + ChromaDB + sentence-transformers |

详见 [Architecture](docs/ARCHITECTURE.md)。

## 开发

```bash
# 启动后端
cd apps/core && source .venv/bin/activate && python app.py

# 启动 Worker（另一个终端）
python worker.py

# 启动桌面应用（另一个终端）
cd apps/desktop && npm run tauri dev
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ECHOTRACE_CORE_DIR` | Core 目录路径 | `../core` |
| `ECHOTRACE_PYTHON` | Python 可执行文件 | `python3.12` |
| `ECHOTRACE_FFMPEG` | FFmpeg 可执行文件 | 自动检测 |
| `MCP_PROVIDERS_PATH` | MCP 配置文件路径 | — |

## 文档

- [架构说明](docs/ARCHITECTURE.md)
- [隐私声明](docs/PRIVACY.md)
- [Core API](apps/core/README.md)
- [Desktop App](apps/desktop/README.md)

## 参与贡献

欢迎提交 Issue 和 Pull Request，详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

发现安全漏洞请勿公开提交 Issue，请按 [SECURITY.md](SECURITY.md) 中的流程报告。

## License

[MIT](LICENSE)
