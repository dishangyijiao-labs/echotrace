# 语迹（EchoTrace）

智能媒体转录管理系统 - 批量将本地音视频转换为文本并支持全文搜索

## 快速开始

详细文档请查看 [README_MVP.md](./README_MVP.md)

### 启动后端
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

### 启动前端
```bash
cd frontend
npm run dev
```


## 代码风格

- 安装开发依赖：`pip install -e .[develop]`
- 运行 Ruff 检查：`ruff check backend src`
- 自动修复常见问题：`ruff check backend src --fix`
## 技术栈

- Django + Django REST Framework
- React + Vite
- faster-whisper (OpenAI Whisper)
- SQLite

## 核心功能

- 批量上传本地音视频文件
- 自动转录为文本
- 全文搜索
- 时间轴分段展示
