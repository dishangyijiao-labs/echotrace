# 变更记录

每次功能变更完成后写入。新 session 开始前 AI 必须阅读本文件。

---

## [2026-04-16] 混合检索 RRF 融合 + LLM 结构化输出

### 改了什么
- `rag/retriever.py`：混合检索从简单拼接改为 Reciprocal Rank Fusion (RRF) 算法
  - FTS5 关键词搜索利用 `rank` 函数获取 BM25 分数并归一化到 [0,1]
  - ChromaDB 语义搜索的 L2 距离归一化为相似度分数
  - hybrid 模式用 RRF 公式（k=60）统一融合两个排名列表
  - 语义搜索补充文件名改为批量查询，消除 N+1
- `llm_service.py`：新增结构化输出支持
  - Pydantic 模型：`OutlineResult`（大纲）、`ActionItemsResult`（行动要点）
  - OpenAI 兼容 API 启用 `response_format: json_object`
  - 自动解析 JSON（含 markdown fence 剥离）+ Pydantic 校验
  - 解析失败时 graceful fallback 返回原始文本
  - Claude 模型名更新为最新版本
- `app.py`：`/summarize` 端点支持返回结构化 `data` 字段，保持 `summary` 向后兼容

### 为什么
- 简历写了"混合检索"和"结构化输出"，但原实现中混合检索只是简单去重拼接，结构化输出完全缺失
- RRF 是工业界标准的多路检索融合算法（Microsoft 论文），面试可以具体讲原理
- 结构化输出让 LLM 返回可解析的 JSON，前端可以做结构化渲染

### 影响范围
- `apps/core/rag/retriever.py` — 混合检索核心逻辑重写
- `apps/core/llm_service.py` — 新增 Pydantic 模型、JSON mode、解析逻辑
- `apps/core/app.py` — `/summarize` 端点响应格式扩展
- API 向后兼容：`summary` 字段保留，新增 `data` 和 `prompt_type` 字段

### 关键决策
- 选 RRF 而非线性加权融合：RRF 只依赖排名不依赖原始分数，对异构检索源更鲁棒
- k=60 为学术论文标准值，未做调优（数据量不够大，调了意义不大）
- 结构化输出解析失败时返回 `{"raw": "...", "_parse_error": true}` 而非抛异常，保证用户总能看到结果

## [2026-04-16] 引入产品工程协作协议

### 改了什么
- 新增 `protocol/` 目录，包含完整的产品工程协作协议模板
- 重写 `CLAUDE.md`，整合 AI 协作规则（角色分工、三步循环、Spec 驱动 + TDD、变更记录规范）

### 为什么
- 建立人 + AI 协作的标准化工作流，确保架构决策由人做出、代码变更可追溯

### 影响范围
- `CLAUDE.md` — 全文重写，新增协作规则
- `protocol/` — 新目录，5 个协议文件

### 关键决策
- 直接使用 protocol-template 模板的通用部分，项目概述替换为 EchoTrace 描述
