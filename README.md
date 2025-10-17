# 语迹（EchoTrace）

智能媒体转录管理系统 - 批量将本地音视频转换为文本并支持全文搜索

## 快速开始

详细文档请查看 [README_MVP.md](./README_MVP.md)

### 使用 Docker Compose（推荐）

1. 一键启动：
   ```bash
   ./scripts/start.sh
   ```
   （等价于执行 `docker compose up --build backend frontend`）
2. （可选）手动构建并启动前后端服务：
   ```bash
   docker compose up --build backend frontend
   ```
3. 前端访问地址：<http://localhost:8080>
4. 后端 API 地址：<http://localhost:8001/api>

默认会创建以下持久化目录/卷：
- `backend_data`：存放 SQLite 数据库文件（容器内路径 `/app/data/db.sqlite3`）
- `backend_media`：存放上传的媒体文件（容器内路径 `/app/media`）
- `./pipeline_data/*`：管线任务的输入、输出、日志和模型缓存

常用操作：
- 停止服务：`docker compose down`
- 重新构建镜像：`docker compose build`
- 清理持久化数据：`docker compose down -v`

#### 管线（Pipeline）服务

管线容器默认使用 `pipeline` 配置文件，可通过 `docker compose run` 按需执行：

```bash
docker compose run --rm pipeline python -m src.pipeline.cli run --config config/config.yaml
```

如果需要访问/共享数据，可将媒体文件放置在 `./pipeline_data/input`，处理结果会输出到 `./pipeline_data/output`。

### 手动启动（开发模式）

#### 后端
```bash
cd backend
source venv/bin/activate
python manage.py runserver 0.0.0.0:8001
```

#### 前端
```bash
cd frontend
npm run dev -- --host
```

## Docker 配置

- 后端容器支持以下环境变量：
  - `DJANGO_DEBUG`（默认 `true`）
  - `DJANGO_SECRET_KEY`
  - `DJANGO_ALLOWED_HOSTS`（逗号分隔）
  - `DJANGO_CORS_ALLOW_ALL` / `DJANGO_CORS_ALLOWED_ORIGINS`
  - `DJANGO_DB_PATH`、`DJANGO_MEDIA_ROOT`、`DJANGO_STATIC_ROOT`
- 前端镜像在构建阶段接受 `VITE_API_BASE` 构建参数，用于覆盖 API 地址：
  ```bash
  docker compose build --build-arg VITE_API_BASE=https://example.com/api frontend
  ```
- 前端容器基于 Nginx，端口映射为 `8080 -> 80`，并已开启单页应用回退至 `index.html`
- 管线容器挂载的本地目录位于 `./pipeline_data/`，可按需备份或清理。


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
