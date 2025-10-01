# 媒体文件转录管理系统 MVP

## 项目简介

这是一个简单的企业数据管理系统,用于批量处理本地音视频资源,将其转换为文本并存储到数据库,支持全文搜索,可以快速找到对应的音视频资源。

## 技术栈

- **后端**: Django 5.2 + Django REST Framework + SQLite
- **前端**: React 18 + Vite + Axios
- **转录引擎**: faster-whisper (基于 OpenAI Whisper)
- **数据库**: SQLite (内置,无需额外配置)

## 核心功能

1. **批量上传**: 通过输入本地文件路径批量添加音视频文件
2. **自动转录**: 使用 Whisper 模型将音视频转换为文本
3. **全文搜索**: 在转录文本中搜索关键词,快速定位音视频
4. **分段展示**: 显示转录的时间轴分段信息

## 项目结构

```
media-cleaning-mvp/
├── backend/                # Django后端
│   ├── media_manager/     # Django主项目
│   ├── media/             # 媒体管理应用
│   │   ├── models.py      # 数据模型(MediaFile, TranscriptSegment)
│   │   ├── views.py       # API视图
│   │   ├── serializers.py # 序列化器
│   │   ├── transcribe_service.py  # 转录服务
│   │   └── admin.py       # 后台管理
│   ├── db.sqlite3         # SQLite数据库
│   └── manage.py
├── frontend/              # React前端
│   ├── src/
│   │   ├── App.jsx        # 主应用组件
│   │   └── App.css        # 样式
│   └── package.json
└── README_MVP.md          # 本文档
```

## 数据库设计

### MediaFile (媒体文件表)
- `id`: 主键
- `filename`: 文件名
- `file_path`: 本地文件路径
- `file_size`: 文件大小
- `duration`: 时长
- `file_type`: 文件类型
- `transcript_text`: 完整转录文本
- `language`: 语言
- `status`: 状态 (pending/processing/completed/failed)
- `created_at`: 创建时间
- `updated_at`: 更新时间

### TranscriptSegment (转录片段表)
- `id`: 主键
- `media_file_id`: 外键关联媒体文件
- `start_time`: 开始时间
- `end_time`: 结束时间
- `text`: 文本内容

## API 接口

### 1. 批量上传文件
```
POST /api/files/batch_upload/
{
  "file_paths": [
    "/path/to/video1.mp4",
    "/path/to/audio1.mp3"
  ]
}
```

### 2. 批量转录
```
POST /api/files/batch_transcribe/
```

### 3. 转录单个文件
```
POST /api/files/{id}/transcribe/
```

### 4. 搜索
```
GET /api/files/search/?q=关键词
```

### 5. 获取所有文件
```
GET /api/files/
```

## 快速开始

### 1. 启动后端

```bash
# 进入backend目录
cd backend

# 激活虚拟环境(已创建)
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 运行开发服务器
python manage.py runserver
```

后端将运行在 `http://localhost:8000`

### 2. 启动前端

```bash
# 新开一个终端,进入frontend目录
cd frontend

# 启动开发服务器
npm run dev
```

前端将运行在 `http://localhost:5173`

### 3. 访问系统

在浏览器打开 `http://localhost:5173`,即可使用系统。

## 使用流程

1. **添加文件**: 在"批量添加本地文件"区域输入音视频文件的绝对路径,每行一个
2. **转录**: 点击"转录所有待处理文件"按钮,系统会自动转录所有pending状态的文件
3. **查看结果**: 转录完成后,可以在文件列表中查看转录文本和分段信息
4. **搜索**: 在搜索框输入关键词,可以搜索文件名或转录文本内容

## 示例

假设你有一个音频文件 `/Users/john/audio/meeting.mp3`:

1. 在文本框中输入: `/Users/john/audio/meeting.mp3`
2. 点击"添加文件",系统会创建一条记录,状态为 `pending`
3. 点击"转录所有待处理文件",系统会调用 Whisper 进行转录
4. 转录完成后,状态变为 `completed`,可以查看转录文本
5. 在搜索框输入"会议主题",可以快速找到这个文件

## 后台管理

访问 `http://localhost:8000/admin` 可以使用 Django 后台管理界面。

首先需要创建管理员账号:
```bash
python backend/manage.py createsuperuser
```

## 注意事项

1. **文件路径**: 必须是本地文件的绝对路径
2. **转录速度**: 取决于文件大小和电脑性能,首次运行会下载 Whisper 模型
3. **模型选择**: 默认使用 `base` 模型,可在 `transcribe_service.py` 中修改
4. **CORS**: 开发环境已配置允许所有来源,生产环境需要修改
5. **数据库**: SQLite 适合 MVP,生产环境建议使用 PostgreSQL/MySQL

## MVP 设计原则

本项目严格遵循 MVP(最小可行产品)原则:

- ✅ 使用 SQLite 而非复杂数据库
- ✅ 前后端分离但结构简单
- ✅ 无用户认证系统(可后续添加)
- ✅ 无文件上传功能,直接使用本地路径
- ✅ 基础的搜索功能,无高级过滤
- ✅ 简洁的界面设计

## 后续扩展方向

1. 添加用户认证和权限管理
2. 支持文件上传而非仅路径输入
3. 使用 PostgreSQL/MySQL 数据库
4. 添加全文检索引擎(如 Elasticsearch)
5. 支持更多音视频格式
6. 添加转录任务队列(Celery)
7. 导出转录结果为 PDF/Word
8. 添加音视频播放器并支持字幕同步

## 许可

MIT License
