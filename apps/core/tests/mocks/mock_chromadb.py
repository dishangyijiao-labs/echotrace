"""Mock ChromaDB client for tests — no vector DB required."""
from __future__ import annotations


class MockCollection:
    def __init__(self, name: str):
        self.name = name
        self._docs: list[dict] = []

    def add(self, documents, metadatas=None, ids=None) -> None:
        for i, doc in enumerate(documents):
            self._docs.append({
                "id": ids[i] if ids else str(i),
                "document": doc,
                "metadata": metadatas[i] if metadatas else {},
            })

    def query(self, query_texts, n_results=10, **kwargs) -> dict:
        # Return all stored docs as results (no real similarity)
        docs = self._docs[:n_results]
        return {
            "documents": [[d["document"] for d in docs]],
            "metadatas": [[d["metadata"] for d in docs]],
            "ids": [[d["id"] for d in docs]],
            "distances": [[0.1 * i for i in range(len(docs))]],
        }

    def count(self) -> int:
        return len(self._docs)


class MockChromaClient:
    def __init__(self):
        self._collections: dict[str, MockCollection] = {}

    def get_or_create_collection(self, name: str, **kwargs) -> MockCollection:
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def list_collections(self) -> list[MockCollection]:
        return list(self._collections.values())
