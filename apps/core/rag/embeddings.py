"""
Embedding 服务 - 支持本地和云端模型
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import OpenAIEmbeddings

APP_ROOT = Path(__file__).resolve().parent.parent
EMBEDDINGS_CACHE = APP_ROOT / "data" / "embeddings_cache"


class EmbeddingService:
    """统一的 Embedding 服务接口"""

    def __init__(self, provider: str = "local", model: str | None = None):
        """
        Args:
            provider: "local" (sentence-transformers) or "openai"
            model: 模型名称，None 时使用默认
        """
        self.provider = provider
        self.embeddings = self._init_embeddings(provider, model)

    def _init_embeddings(self, provider: str, model: str | None):
        if provider == "openai":
            # 云端 OpenAI Embeddings
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY not set")
            return OpenAIEmbeddings(
                model=model or "text-embedding-3-small",
                openai_api_key=api_key,
            )
        else:
            # 本地 Sentence Transformers
            EMBEDDINGS_CACHE.mkdir(parents=True, exist_ok=True)
            return HuggingFaceEmbeddings(
                model_name=model or "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                cache_folder=str(EMBEDDINGS_CACHE),
                # 多语言模型，支持中英文
                model_kwargs={"device": "cpu"},  # 桌面版默认 CPU
                encode_kwargs={"normalize_embeddings": True},
            )

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """批量向量化文档"""
        return self.embeddings.embed_documents(texts)

    def embed_query(self, text: str) -> List[float]:
        """向量化查询"""
        return self.embeddings.embed_query(text)


# 单例模式，延迟初始化
_embedding_service: EmbeddingService | None = None


def get_embedding_service(provider: str = "local", model: str | None = None) -> EmbeddingService:
    """获取 Embedding 服务单例"""
    global _embedding_service
    if _embedding_service is None or _embedding_service.provider != provider:
        _embedding_service = EmbeddingService(provider, model)
    return _embedding_service
