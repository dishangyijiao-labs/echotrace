"""
Agent 服务 - 基于 LangChain/LangGraph
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

from langchain.agents import AgentExecutor, create_react_agent
from langchain.prompts import PromptTemplate
from langchain.tools import Tool
from langchain_openai import ChatOpenAI

from rag.retriever import get_retriever

APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = APP_ROOT / "data" / "app.db"


# ==================== Agent 工具定义 ====================

def create_search_tool(db_path: Path) -> Tool:
    """创建搜索工具"""
    retriever = get_retriever(db_path)

    def search_videos(query: str) -> str:
        """搜索视频内容，返回相关片段"""
        results = retriever.search(query, mode="hybrid", limit=5)
        if not results:
            return "未找到相关内容"
        
        output = []
        for i, r in enumerate(results, 1):
            output.append(
                f"{i}. [{r['filename']}] {r['start']:.1f}s-{r['end']:.1f}s\n"
                f"   {r['text']}\n"
                f"   (来源: {r['source']}, 分数: {r['score']:.3f})"
            )
        return "\n\n".join(output)

    return Tool(
        name="search_videos",
        func=search_videos,
        description="搜索视频库中的内容。输入：搜索关键词或问题。输出：相关视频片段及时间戳。",
    )


def create_timestamp_tool(db_path: Path) -> Tool:
    """创建时间戳定位工具"""
    import sqlite3

    def find_exact_moment(description: str) -> str:
        """根据描述精确定位视频时刻"""
        retriever = get_retriever(db_path)
        results = retriever.search(description, mode="semantic", limit=3)
        
        if not results:
            return "未找到匹配的时刻"
        
        # 返回最匹配的结果
        best = results[0]
        return (
            f"找到最佳匹配：\n"
            f"文件：{best['filename']}\n"
            f"时间：{best['start']:.1f}s - {best['end']:.1f}s\n"
            f"内容：{best['text']}\n"
            f"置信度：{best['score']:.2f}"
        )

    return Tool(
        name="find_exact_moment",
        func=find_exact_moment,
        description="根据描述精确定位视频中的某个时刻。输入：对视频内容的描述。输出：精确的时间戳和文件名。",
    )


# ==================== Agent 定义 ====================

class VideoSearchAgent:
    """视频搜索 Agent"""

    def __init__(
        self,
        db_path: Path = DEFAULT_DB_PATH,
        model: str = "gpt-4o-mini",
        api_key: str | None = None,
    ):
        self.db_path = db_path
        
        # 初始化 LLM
        self.llm = ChatOpenAI(
            model=model,
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            temperature=0,
        )
        
        # 创建工具
        self.tools = [
            create_search_tool(db_path),
            create_timestamp_tool(db_path),
        ]
        
        # ReAct Prompt
        self.prompt = PromptTemplate.from_template(
            """你是一个视频内容搜索助手，帮助用户快速找到视频中的特定片段。

你可以使用以下工具：
{tools}

工具名称: {tool_names}

请使用以下格式回答：

Question: 用户的问题
Thought: 思考应该采取什么行动
Action: 要使用的工具名称，从 [{tool_names}] 中选择
Action Input: 传递给工具的输入
Observation: 工具返回的结果
... (可以重复 Thought/Action/Action Input/Observation 多次)
Thought: 我现在知道最终答案了
Final Answer: 对用户问题的最终答案

开始！

Question: {input}
Thought: {agent_scratchpad}
"""
        )
        
        # 创建 Agent
        self.agent = create_react_agent(self.llm, self.tools, self.prompt)
        self.executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True,
            max_iterations=5,
        )

    def run(self, query: str) -> str:
        """运行 Agent 处理查询"""
        try:
            result = self.executor.invoke({"input": query})
            return result.get("output", "抱歉，无法处理您的请求")
        except Exception as e:
            return f"处理出错：{str(e)}"


# ==================== 多 Agent 协作示例 ====================

class ClipExtractorAgent:
    """视频片段提取建议 Agent"""

    def __init__(self, model: str = "gpt-4o-mini", api_key: str | None = None):
        self.llm = ChatOpenAI(
            model=model,
            api_key=api_key or os.getenv("OPENAI_API_KEY"),
            temperature=0.3,
        )

    def suggest_clips(self, search_results: List[Dict[str, Any]], theme: str) -> str:
        """
        基于搜索结果，建议如何剪辑片段
        
        Args:
            search_results: 搜索到的视频片段列表
            theme: 主题（如"AI创业"、"产品设计"）
        
        Returns:
            剪辑建议
        """
        if not search_results:
            return "没有可用的片段"
        
        # 构建 prompt
        clips_text = "\n".join([
            f"- [{r['filename']}] {r['start']:.1f}s-{r['end']:.1f}s: {r['text']}"
            for r in search_results
        ])
        
        prompt = f"""你是一个短视频剪辑顾问。以下是关于"{theme}"主题的视频片段：

{clips_text}

请提供剪辑建议：
1. 哪些片段最适合做短视频？
2. 建议的剪辑顺序
3. 每个片段的核心亮点
4. 建议的总时长

请以清晰的列表形式回答。"""

        response = self.llm.invoke(prompt)
        return response.content


# 单例
_search_agent: VideoSearchAgent | None = None


def get_search_agent() -> VideoSearchAgent:
    """获取搜索 Agent 单例"""
    global _search_agent
    if _search_agent is None:
        _search_agent = VideoSearchAgent()
    return _search_agent
