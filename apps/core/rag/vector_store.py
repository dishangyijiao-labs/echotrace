"""
向量存储 - 基于 ChromaDB
"""
from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import List, Dict, Any

from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

from rag.embeddings import get_embedding_service

APP_ROOT = Path(__file__).resolve().parent.parent
CHROMA_DIR = APP_ROOT / "data" / "chroma_db"


class VectorStoreService:
    """向量存储服务"""

    def __init__(
        self,
        collection_name: str = "echotrace_segments",
        embedding_provider: str = "local",
    ):
        self.collection_name = collection_name
        self.embedding_service = get_embedding_service(embedding_provider)
        
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        self.vectorstore = Chroma(
            collection_name=collection_name,
            embedding_function=self.embedding_service.embeddings,
            persist_directory=str(CHROMA_DIR),
        )

    def index_transcript(self, transcript_id: int, segments: List[Dict[str, Any]]) -> int:
        """
        为转录文本的分段建立向量索引
        
        Args:
            transcript_id: 转录文本 ID
            segments: 分段列表 [{"id": 1, "start": 0.0, "end": 5.2, "text": "..."}]
        
        Returns:
            索引的分段数量
        """
        if not segments:
            return 0

        documents = []
        for seg in segments:
            doc = Document(
                page_content=seg["text"],
                metadata={
                    "transcript_id": transcript_id,
                    "segment_id": seg["id"],
                    "start": seg["start"],
                    "end": seg["end"],
                },
            )
            documents.append(doc)

        self.vectorstore.add_documents(documents)
        return len(documents)

    def search_semantic(
        self,
        query: str,
        k: int = 10,
        filter_dict: Dict[str, Any] | None = None,
    ) -> List[Dict[str, Any]]:
        """
        语义搜索
        
        Args:
            query: 查询文本
            k: 返回结果数量
            filter_dict: 过滤条件，如 {"transcript_id": 5}
        
        Returns:
            搜索结果列表
        """
        results = self.vectorstore.similarity_search_with_score(
            query,
            k=k,
            filter=filter_dict,
        )

        output = []
        for doc, score in results:
            output.append({
                "text": doc.page_content,
                "score": float(score),
                "transcript_id": doc.metadata.get("transcript_id"),
                "segment_id": doc.metadata.get("segment_id"),
                "start": doc.metadata.get("start"),
                "end": doc.metadata.get("end"),
            })
        return output

    def delete_by_transcript(self, transcript_id: int) -> None:
        """删除某个转录文本的所有向量"""
        self.vectorstore.delete(
            filter={"transcript_id": transcript_id}
        )


# 单例模式
_vector_store: VectorStoreService | None = None


def get_vector_store(embedding_provider: str = "local") -> VectorStoreService:
    """获取向量存储服务单例"""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStoreService(embedding_provider=embedding_provider)
    return _vector_store


# ==================== 数据库同步工具 ====================

def sync_all_transcripts_to_vector(db_path: Path, embedding_provider: str = "local") -> Dict[str, int]:
    """
    将所有现有转录文本同步到向量库
    
    Returns:
        {"transcripts": 处理的转录数, "segments": 索引的分段数}
    """
    vector_store = get_vector_store(embedding_provider)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 查询所有转录文本
    transcripts = conn.execute("SELECT id FROM transcript").fetchall()
    
    total_transcripts = 0
    total_segments = 0

    for t in transcripts:
        transcript_id = t["id"]
        
        # 获取该转录的所有分段
        segments = conn.execute(
            "SELECT id, start, end, text FROM segment WHERE transcript_id = ?",
            (transcript_id,),
        ).fetchall()

        seg_list = [dict(s) for s in segments]
        indexed = vector_store.index_transcript(transcript_id, seg_list)
        
        total_transcripts += 1
        total_segments += indexed

    conn.close()
    return {"transcripts": total_transcripts, "segments": total_segments}
