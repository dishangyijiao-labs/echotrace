"""
简化的搜索服务 - 不依赖复杂的 Agent 框架
提供基于 RAG 的智能搜索功能
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Dict, Any

try:
    from langchain_openai import ChatOpenAI
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False

from rag.retriever import get_retriever

APP_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = APP_ROOT / "data" / "app.db"


# ==================== 简化的搜索服务 ====================

class VideoSearchAgent:
    """视频搜索服务（简化版）"""

    def __init__(
        self,
        db_path: Path = DEFAULT_DB_PATH,
        model: str = "gpt-4o-mini",
        api_key: str | None = None,
    ):
        self.db_path = db_path
        self.retriever = get_retriever(db_path)
        
        # 初始化 LLM（如果可用）
        if LLM_AVAILABLE:
            self.llm = ChatOpenAI(
                model=model,
                api_key=api_key or os.getenv("OPENAI_API_KEY"),
                temperature=0,
            )
        else:
            self.llm = None

    def run(self, query: str) -> str:
        """运行搜索查询"""
        try:
            # 1. 使用混合检索获取结果
            results = self.retriever.search(query, mode="hybrid", limit=5)
            
            if not results:
                return "未找到相关内容"
            
            # 2. 格式化结果
            output = []
            for i, r in enumerate(results, 1):
                output.append(
                    f"{i}. [{r['filename']}] {r['start']:.1f}s-{r['end']:.1f}s\n"
                    f"   {r['text']}\n"
                    f"   (相关度: {r['score']:.3f})"
                )
            
            formatted_results = "\n\n".join(output)
            
            # 3. 如果有 LLM，生成更智能的回答
            if self.llm:
                try:
                    prompt = f"""根据以下搜索结果，简洁地回答用户的问题。

用户问题：{query}

搜索结果：
{formatted_results}

请提供：
1. 直接回答用户的问题
2. 引用最相关的片段（包括文件名和时间戳）
3. 如果有多个相关片段，简要说明它们的关联
"""
                    response = self.llm.invoke(prompt)
                    return response.content
                except Exception as e:
                    # LLM 调用失败，返回原始结果
                    return f"搜索结果：\n\n{formatted_results}"
            else:
                return f"搜索结果：\n\n{formatted_results}"
                
        except Exception as e:
            return f"搜索出错：{str(e)}"


class ClipExtractorAgent:
    """视频片段提取建议服务"""

    def __init__(self, model: str = "gpt-4o-mini", api_key: str | None = None):
        if LLM_AVAILABLE:
            self.llm = ChatOpenAI(
                model=model,
                api_key=api_key or os.getenv("OPENAI_API_KEY"),
                temperature=0.3,
            )
        else:
            self.llm = None

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
        
        if not self.llm:
            # 没有 LLM，返回简单的列表
            clips_text = "\n".join([
                f"- [{r['filename']}] {r['start']:.1f}s-{r['end']:.1f}s: {r['text']}"
                for r in search_results
            ])
            return f"找到以下片段：\n{clips_text}"
        
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

        try:
            response = self.llm.invoke(prompt)
            return response.content
        except Exception as e:
            return f"生成建议失败：{str(e)}\n\n原始片段列表：\n{clips_text}"


# 单例
_search_agent: VideoSearchAgent | None = None


def get_search_agent(db_path: Path = DEFAULT_DB_PATH) -> VideoSearchAgent:
    """获取搜索服务单例"""
    global _search_agent
    if _search_agent is None:
        _search_agent = VideoSearchAgent(db_path)
    return _search_agent
