"""
RAG 功能快速测试脚本
确保 Core API 已启动（python app.py）
"""
import requests
import json

BASE_URL = "http://127.0.0.1:8787"


def test_rag_status():
    """测试 RAG 模块状态"""
    print("=== 测试 RAG 模块状态 ===")
    response = requests.get(f"{BASE_URL}/rag/status")
    data = response.json()
    
    if data["enabled"]:
        print("✅ RAG 模块已启用")
        print(f"   功能: {json.dumps(data['features'], indent=2, ensure_ascii=False)}")
    else:
        print("❌ RAG 模块未启用")
        print("   请运行: pip install -r requirements-rag.txt")
    
    return data["enabled"]


def test_sync_vectors():
    """测试向量库同步"""
    print("\n=== 测试向量库同步 ===")
    response = requests.post(f"{BASE_URL}/rag/sync-all", params={"embedding_provider": "local"})
    data = response.json()
    
    if data["ok"]:
        print(f"✅ 同步成功")
        print(f"   处理转录: {data['transcripts']} 个")
        print(f"   索引分段: {data['segments']} 个")
    else:
        print(f"❌ 同步失败: {data}")
    
    return data["ok"]


def test_semantic_search():
    """测试语义搜索"""
    print("\n=== 测试语义搜索 ===")
    
    test_queries = [
        {"query": "产品设计", "mode": "hybrid"},
        {"query": "如何提升用户体验", "mode": "semantic"},
        {"query": "AI", "mode": "keyword"},
    ]
    
    for test in test_queries:
        print(f"\n查询: '{test['query']}' (模式: {test['mode']})")
        response = requests.post(
            f"{BASE_URL}/search/semantic",
            json={"query": test["query"], "mode": test["mode"], "limit": 3}
        )
        data = response.json()
        
        if data["ok"] and data["data"]:
            print(f"✅ 找到 {len(data['data'])} 条结果")
            for i, result in enumerate(data["data"][:2], 1):
                print(f"   {i}. [{result['filename']}] {result['start']:.1f}s-{result['end']:.1f}s")
                print(f"      {result['text'][:80]}...")
                print(f"      来源: {result['source']}, 分数: {result['score']:.3f}")
        else:
            print(f"   未找到结果")


def main():
    print("🚀 EchoTrace RAG 功能测试\n")
    
    # 1. 检查 RAG 状态
    if not test_rag_status():
        return
    
    # 2. 同步向量库
    if not test_sync_vectors():
        print("\n⚠️  向量库同步失败，可能是因为没有转录数据")
        print("   请先导入媒体文件并完成转录")
    
    # 3. 测试语义搜索
    test_semantic_search()
    
    print("\n" + "="*50)
    print("✅ 测试完成！")
    print("\n📖 详细文档: docs/RAG_AGENT_GUIDE.md")
    print("🖥️  前端界面: 访问应用 → AI 搜索")


if __name__ == "__main__":
    main()
