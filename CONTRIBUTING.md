# Contributing to EchoTrace

感谢你对 EchoTrace 的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境

### 前置要求

- Python 3.12
- Node.js 20+
- FFmpeg
- Rust (Tauri 需要)

### 本地搭建

```bash
# 克隆仓库
git clone https://github.com/dishangyijiao-labs/echotrace.git
cd echotrace

# 安装 Python 依赖
cd apps/core
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 安装前端依赖
cd ../desktop
npm install

# 启动开发环境（三个终端）
# 终端 1: API 服务
cd apps/core && source .venv/bin/activate && python app.py

# 终端 2: Worker
cd apps/core && source .venv/bin/activate && python worker.py

# 终端 3: 桌面应用
cd apps/desktop && npm run tauri dev
```

### 运行测试

```bash
cd apps/core
source .venv/bin/activate
pytest
```

## 提交 Pull Request

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/my-feature`
3. 提交更改，commit message 请遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
   - `feat:` 新功能
   - `fix:` 修复 bug
   - `docs:` 文档更新
   - `refactor:` 重构
   - `test:` 测试
   - `chore:` 构建/工具链
4. 确保测试通过：`pytest`
5. 推送并创建 Pull Request

## 提交 Issue

- **Bug 报告**：请包含操作系统、Python/Node 版本、复现步骤和错误日志
- **功能建议**：请描述使用场景和期望行为

## 项目结构

```
echotrace/
├── apps/
│   ├── core/             # Python 后端（FastAPI + SQLite）
│   │   ├── app.py        # API 服务
│   │   ├── worker.py     # 转录任务处理
│   │   ├── pipeline/     # 转录逻辑
│   │   └── rag/          # RAG / AI 功能
│   └── desktop/          # 桌面应用（Tauri + React）
│       ├── src/          # React 前端
│       └── src-tauri/    # Rust 后端
└── docs/                 # 文档
```

详见 [Architecture](docs/ARCHITECTURE.md)。

## 行为准则

请阅读 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
