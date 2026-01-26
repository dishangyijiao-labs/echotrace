# RAG + Agent + LangChain 集成指南

## 🎯 功能概览

EchoTrace 现已集成完整的 RAG + Agent 能力，支持：

✅ **向量检索** - 基于 Chroma 的语义搜索  
✅ **混合检索** - 结合 FTS5 关键词搜索和向量语义搜索  
✅ **LangChain 集成** - 完整的 LangChain 生态支持  
✅ **Agent 工作流** - ReAct Agent + 多 Agent 协作  
✅ **本地/云端双模式** - 支持本地 Embedding 和 OpenAI API  

---

## 📦 安装步骤

### 1. 安装 RAG 依赖

```bash
cd apps/core
pip install -r requirements-rag.txt
```

**依赖说明：**
- `langchain` - LangChain 核心库
- `chromadb` - 向量数据库（本地存储）
- `sentence-transformers` - 本地 Embedding 模型
- `langgraph` - Agent 工作流引擎

### 2. 配置环境变量（可选）

如果要使用 OpenAI 的 Embedding 和 LLM，创建 `.env` 文件：

```bash
# apps/core/.env
OPENAI_API_KEY=sk-xxx...
```

如果不配置，默认使用本地模型（完全离线）。

### 3. 重启服务

```bash
# 重启 Core API
cd apps/core
python app.py

# 重启前端
cd apps/desktop
npm run tauri dev
```

---

## 🚀 使用指南

### 方式一：通过前端界面

1. 启动应用后，点击侧边栏 **"AI 搜索"**
2. 首次使用需点击 **"同步向量库"** 按钮（将现有转录文本索引到向量库）
3. 现在可以使用两种功能：

#### 语义搜索
- 输入查询内容（支持自然语言）
- 选择检索模式：
  - **混合检索**（推荐）- 同时使用关键词和语义
  - **语义检索** - 纯向量相似度搜索
  - **关键词检索** - 传统 FTS5 搜索
- 点击搜索，查看结果

#### Agent 智能助手
- 输入复杂问题或任务描述
- 选择 Agent 类型：
  - **搜索助手** - 自动调用工具，多步推理
  - **剪辑建议助手** - 分析内容，提供剪辑建议
- 发送后，Agent 会自动规划和执行任务

### 方式二：通过 API 调用

#### 1. 语义搜索 API

```bash
curl -X POST http://127.0.0.1:8787/search/semantic \
  -H "Content-Type: application/json" \
  -d '{
    "query": "如何提升用户体验",
    "mode": "hybrid",
    "limit": 10
  }'
```

**响应示例：**
```json
{
  "ok": true,
  "mode": "hybrid",
  "total": 10,
  "data": [
    {
      "segment_id": 123,
      "transcript_id": 5,
      "media_id": 2,
      "filename": "产品设计分享.mp4",
      "start": 125.3,
      "end": 132.8,
      "text": "用户体验的核心是减少认知负担...",
      "source": "semantic",
      "score": 0.856
    }
  ]
}
```

#### 2. Agent 查询 API

```bash
curl -X POST http://127.0.0.1:8787/agent/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "找出所有关于 AI 创业的内容，并建议如何剪成 3 分钟的短视频",
    "agent_type": "clip_extractor"
  }'
```

**响应示例：**
```json
{
  "ok": true,
  "agent": "clip_extractor",
  "response": "根据搜索结果，建议以下剪辑方案：\n\n1. 开场片段（0-30s）...",
  "related_clips": [...]
}
```

#### 3. 同步向量库 API

```bash
# 同步所有现有转录文本
curl -X POST http://127.0.0.1:8787/rag/sync-all?embedding_provider=local
```

#### 4. 为单个转录建立索引

```bash
curl -X POST http://127.0.0.1:8787/rag/index?transcript_id=5&embedding_provider=local
```

---

## 🏗️ 架构说明

### 模块结构

```
apps/core/
├── rag/
│   ├── embeddings.py      # Embedding 服务（本地/OpenAI）
│   ├── vector_store.py    # ChromaDB 向量存储
│   ├── retriever.py       # 混合检索器
│   └── agents.py          # Agent 定义（LangChain）
├── data/
│   ├── chroma_db/         # Chroma 向量库数据
│   └── embeddings_cache/  # 本地 Embedding 模型缓存
└── requirements-rag.txt
```

### 数据流

1. **转录文本生成** → Worker 转录完成
2. **向量化** → Embedding Service 将分段转为向量
3. **索引** → 存入 ChromaDB
4. **检索** → 混合检索器（FTS5 + Vector）
5. **Agent 处理** → LangChain Agent 调用工具，多步推理

### 本地 vs 云端模式

| 功能 | 本地模式 | 云端模式 |
|------|---------|---------|
| **Embedding** | sentence-transformers<br>（多语言 MiniLM-L12） | OpenAI text-embedding-3-small |
| **LLM** | 需要额外配置 Ollama | OpenAI GPT-4o-mini |
| **隐私** | ✅ 完全本地 | ⚠️ 文本上传云端 |
| **速度** | 慢（CPU） | 快 |
| **质量** | 中等 | 高 |
| **成本** | 免费 | 按使用付费 |

**默认配置：** 本地 Embedding + 云端 LLM（需配置 API Key）

---

## 技术亮点

### RAG 系统设计
- 使用 ChromaDB 作为向量数据库，支持本地持久化
- 实现了混合检索（BM25 + Dense Retrieval），提升召回率
- 多语言 Embedding 模型支持（paraphrase-multilingual-MiniLM-L12-v2）
- 向量索引与 SQLite FTS5 的协同工作

### LangChain 集成
- 使用 LangChain 的 Tool 抽象，定义了 search_videos 和 find_exact_moment 工具
- 统一的 LLM 接口，支持多模型切换（OpenAI/Ollama）
- PromptTemplate 管理，实现 Prompt 版本化

### Agent 工作流
- 实现了 ReAct Agent（Reasoning + Acting）
- 多 Agent 协作：VideoSearchAgent + ClipExtractorAgent
- Agent 工具链：搜索 → 分析 → 建议
- 可扩展性：易于添加新工具（如导出、播放等）

### 技术挑战与解决方案
- **向量库与关系型数据库同步** - 通过 transcript_id 关联，触发式索引
- **Embedding 模型选型** - 平衡模型大小、速度和多语言支持
- **Agent 幻觉控制** - 通过 ReAct 模式，强制工具调用，减少错误输出
- **桌面应用集成** - FastAPI 后端 + Tauri 前端，完全本地化部署

---

## 🔧 故障排查

### 问题 1：RAG 模块未启用

**现象：** 前端显示 "RAG 模块未启用"

**解决：**
```bash
cd apps/core
pip install -r requirements-rag.txt
```

### 问题 2：本地 Embedding 模型下载慢

**现象：** 首次运行时卡在下载模型

**解决：**
```bash
# 手动下载模型
python -c "
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
"
```

或使用国内镜像：
```bash
export HF_ENDPOINT=https://hf-mirror.com
```

### 问题 3：Agent 查询失败

**现象：** 返回 "查询失败：OPENAI_API_KEY not set"

**解决：**
- 方案 1：配置 OpenAI API Key
  ```bash
  export OPENAI_API_KEY=sk-xxx...
  ```
- 方案 2：切换到本地 LLM（需要额外配置 Ollama）

### 问题 4：向量库同步慢

**现象：** 同步大量转录文本时耗时长

**优化：**
- 使用 OpenAI Embedding（快但需 API Key）
- 批量索引时调整 batch_size

---

## 📚 扩展方向

### 短期（1-2周）

- [ ] 添加 LangSmith 集成（Agent 调用可视化）
- [ ] 实现 Prompt 评估和 A/B 测试
- [ ] 添加更多工具（导出 EDL、生成字幕、多语言翻译）

### 中期（1-2个月）

- [ ] 可视化 Workflow Builder（拖拽式 Agent 编排）
- [ ] 多模态支持（视频帧分析 + 文本检索）
- [ ] Agent 性能监控和成本追踪

### 长期（3-6个月）

- [ ] 开发者平台（API Gateway + SDK）
- [ ] Prompt 模板市场
- [ ] 分布式向量库（支持百万级视频）

---

## 总结

EchoTrace RAG 模块已集成：

✅ **RAG 能力** - 混合检索，语义理解  
✅ **Agent 能力** - ReAct 工作流，多 Agent 协作  
✅ **LangChain 生态** - 完整的工具链和抽象  
✅ **桌面应用** - 本地部署，隐私优先  

欢迎贡献和反馈！
