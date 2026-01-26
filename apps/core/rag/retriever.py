"""
混合检索器 - 结合关键词搜索(FTS5)和语义搜索(向量)
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import List, Dict, Any

from rag.vector_store import get_vector_store


class HybridRetriever:
    """混合检索：关键词 + 语义"""

    def __init__(self, db_path: Path, embedding_provider: str = "local"):
        self.db_path = db_path
        self.vector_store = get_vector_store(embedding_provider)

    def _keyword_search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """FTS5 关键词搜索"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row

        rows = conn.execute(
            """
            SELECT 
                s.id as segment_id,
                s.transcript_id,
                s.start,
                s.end,
                s.text,
                t.media_id,
                m.filename,
                rank
            FROM segment_fts sf
            JOIN segment s ON sf.rowid = s.id
            JOIN transcript t ON s.transcript_id = t.id
            JOIN media m ON t.media_id = m.id
            WHERE segment_fts MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (query, limit),
        ).fetchall()

        conn.close()
        return [
            {
                "segment_id": r["segment_id"],
                "transcript_id": r["transcript_id"],
                "media_id": r["media_id"],
                "filename": r["filename"],
                "start": r["start"],
                "end": r["end"],
                "text": r["text"],
                "source": "keyword",
                "score": -r["rank"],  # FTS5 rank 是负数，越小越相关
            }
            for r in rows
        ]

    def _semantic_search(self, query: str, k: int = 20) -> List[Dict[str, Any]]:
        """向量语义搜索"""
        results = self.vector_store.search_semantic(query, k=k)
        
        # 补充文件名信息
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        
        for item in results:
            transcript_id = item["transcript_id"]
            row = conn.execute(
                """
                SELECT m.id as media_id, m.filename
                FROM transcript t
                JOIN media m ON t.media_id = m.id
                WHERE t.id = ?
                """,
                (transcript_id,),
            ).fetchone()
            
            if row:
                item["media_id"] = row["media_id"]
                item["filename"] = row["filename"]
            item["source"] = "semantic"
        
        conn.close()
        return results

    def search(
        self,
        query: str,
        mode: str = "hybrid",
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        混合搜索
        
        Args:
            query: 查询文本
            mode: "keyword" | "semantic" | "hybrid"
            limit: 返回结果数量
        
        Returns:
            搜索结果列表，包含 segment_id, text, score, source 等
        """
        if mode == "keyword":
            return self._keyword_search(query, limit)
        
        if mode == "semantic":
            return self._semantic_search(query, limit)
        
        # 混合模式：各取一半，然后归并
        k_results = self._keyword_search(query, limit // 2)
        s_results = self._semantic_search(query, limit // 2)
        
        # 简单归并：去重 + 排序
        seen = set()
        merged = []
        
        # 先加语义搜索结果（通常更准确）
        for item in s_results:
            seg_id = item["segment_id"]
            if seg_id not in seen:
                seen.add(seg_id)
                merged.append(item)
        
        # 再加关键词结果
        for item in k_results:
            seg_id = item["segment_id"]
            if seg_id not in seen:
                seen.add(seg_id)
                merged.append(item)
        
        return merged[:limit]


# 单例模式
_retriever: HybridRetriever | None = None


def get_retriever(db_path: Path, embedding_provider: str = "local") -> HybridRetriever:
    """获取混合检索器单例"""
    global _retriever
    if _retriever is None:
        _retriever = HybridRetriever(db_path, embedding_provider)
    return _retriever
