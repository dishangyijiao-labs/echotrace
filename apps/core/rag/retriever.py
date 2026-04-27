"""
混合检索器 - 结合关键词搜索(FTS5)和语义搜索(向量)

融合策略：Reciprocal Rank Fusion (RRF)
- 对 keyword 和 semantic 各自的排名列表，按 RRF 公式计算统一分数
- RRF(d) = Σ 1 / (k + rank_i(d))，k=60 为平滑常数
- 最终按 RRF 分数降序排列
"""
from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path
from typing import List, Dict, Any

from rag.vector_store import get_vector_store

# RRF 平滑常数，学术标准值为 60
_RRF_K = 60


class HybridRetriever:
    """混合检索：关键词 + 语义 + RRF 融合"""

    def __init__(self, db_path: Path, embedding_provider: str = "local"):
        self.db_path = db_path
        self.vector_store = get_vector_store(embedding_provider)

    def _keyword_search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        FTS5 关键词搜索（trigram tokenizer，支持中文子串匹配）

        使用 FTS5 内置 rank 函数获取 BM25 相关性分数（负值，越小越相关），
        转换为 0-1 正向分数。
        """
        with closing(sqlite3.connect(self.db_path)) as conn:
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
                    sf.rank as fts_rank
                FROM segment_fts sf
                JOIN segment s ON sf.rowid = s.id
                JOIN transcript t ON s.transcript_id = t.id
                JOIN media m ON t.media_id = m.id
                WHERE segment_fts MATCH ?
                ORDER BY sf.rank ASC
                LIMIT ?
                """,
                (query, limit),
            ).fetchall()

        if not rows:
            return []

        # FTS5 rank 是负值（BM25），越小越相关。归一化到 [0, 1]。
        raw_ranks = [r["fts_rank"] for r in rows]
        min_rank = min(raw_ranks)
        max_rank = max(raw_ranks)
        rank_range = max_rank - min_rank if max_rank != min_rank else 1.0

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
                # min_rank 最相关 → score=1.0，max_rank 最不相关 → score≈0
                "score": round(1.0 - (r["fts_rank"] - min_rank) / rank_range, 4),
            }
            for r in rows
        ]

    def _semantic_search(self, query: str, k: int = 20) -> List[Dict[str, Any]]:
        """
        向量语义搜索

        ChromaDB 返回的 score 是 L2 距离（越小越相似），归一化到 [0, 1]。
        批量查询补充文件名信息，避免 N+1。
        """
        results = self.vector_store.search_semantic(query, k=k)
        if not results:
            return results

        # 归一化 ChromaDB L2 距离为相似度分数
        raw_scores = [item["score"] for item in results]
        max_dist = max(raw_scores) if raw_scores else 1.0
        if max_dist == 0:
            max_dist = 1.0

        for item in results:
            # L2 距离越小越相似 → 转为 0-1 相似度
            item["score"] = round(1.0 - item["score"] / (max_dist + 1e-6), 4)

        # 批量查询补充文件名，消除 N+1
        transcript_ids = list({item["transcript_id"] for item in results if item.get("transcript_id")})
        if not transcript_ids:
            for item in results:
                item["source"] = "semantic"
            return results

        placeholders = ",".join("?" * len(transcript_ids))
        with closing(sqlite3.connect(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                f"""
                SELECT t.id as transcript_id, m.id as media_id, m.filename
                FROM transcript t
                JOIN media m ON t.media_id = m.id
                WHERE t.id IN ({placeholders})
                """,
                transcript_ids,
            ).fetchall()

        meta_map = {r["transcript_id"]: {"media_id": r["media_id"], "filename": r["filename"]} for r in rows}

        for item in results:
            tid = item.get("transcript_id")
            if tid and tid in meta_map:
                item["media_id"] = meta_map[tid]["media_id"]
                item["filename"] = meta_map[tid]["filename"]
            item["source"] = "semantic"

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

        # ---- Hybrid: Reciprocal Rank Fusion (RRF) ----
        # 各取较多结果，RRF 融合后再截断
        fetch_k = max(limit * 2, 40)
        k_results = self._keyword_search(query, fetch_k)
        s_results = self._semantic_search(query, fetch_k)

        # 为每条结果按其在各列表中的排名计算 RRF 分数
        # RRF(d) = Σ 1/(k + rank_i(d))
        rrf_scores: Dict[int, float] = {}
        merged_items: Dict[int, Dict[str, Any]] = {}

        for rank, item in enumerate(k_results):
            seg_id = item["segment_id"]
            rrf_scores[seg_id] = rrf_scores.get(seg_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            if seg_id not in merged_items:
                merged_items[seg_id] = item

        for rank, item in enumerate(s_results):
            seg_id = item["segment_id"]
            rrf_scores[seg_id] = rrf_scores.get(seg_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
            if seg_id not in merged_items:
                merged_items[seg_id] = item

        # 按 RRF 分数降序排列
        sorted_ids = sorted(rrf_scores, key=lambda sid: rrf_scores[sid], reverse=True)

        result = []
        for seg_id in sorted_ids[:limit]:
            item = merged_items[seg_id]
            item["rrf_score"] = round(rrf_scores[seg_id], 6)
            # 标记来源：如果同时出现在两个列表中
            in_keyword = any(r["segment_id"] == seg_id for r in k_results)
            in_semantic = any(r["segment_id"] == seg_id for r in s_results)
            if in_keyword and in_semantic:
                item["source"] = "hybrid"
            result.append(item)

        return result


# 单例模式
_retriever: HybridRetriever | None = None


def get_retriever(db_path: Path, embedding_provider: str = "local") -> HybridRetriever:
    """获取混合检索器单例"""
    global _retriever
    if _retriever is None or _retriever.vector_store.embedding_service.provider != embedding_provider:
        _retriever = HybridRetriever(db_path, embedding_provider)
    return _retriever
