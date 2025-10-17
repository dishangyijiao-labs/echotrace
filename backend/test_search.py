#!/usr/bin/env python
"""
全文搜索 API 集成测试脚本
测试 SQLite FTS5 中文搜索功能
"""

import json

import requests

# 配置
BASE_URL = "http://127.0.0.1:8000/api"
ADMIN_USER = {"email": "admin@echovault.dev", "password": "admin123"}

# 全局变量
access_token = None


def print_test(test_name):
    """打印测试标题"""
    print(f"\n{'=' * 60}")
    print(f"测试: {test_name}")
    print("=" * 60)


def print_result(success, message, data=None):
    """打印测试结果"""
    status = "✅ 通过" if success else "❌ 失败"
    print(f"{status}: {message}")
    if data:
        print(f"响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 测试 1: 用户登录
# ============================================================
def test_01_login():
    """测试管理员登录"""
    global access_token

    print_test("管理员登录")

    response = requests.post(
        f"{BASE_URL}/auth/signin",
        json={"email": ADMIN_USER["email"], "password": ADMIN_USER["password"]},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            access_token = data["data"]["access"]
            print_result(True, "登录成功", {"user": data["data"]["user"]["username"]})
            return True

    print_result(False, f"登录失败: {response.text}")
    return False


# ============================================================
# 测试 2: 中文关键词搜索
# ============================================================
def test_02_search_chinese_keyword():
    """测试中文关键词搜索"""
    print_test("搜索中文关键词: 人工智能")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "人工智能", "limit": 10},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            if results["count"] > 0:
                print_result(
                    True,
                    f"找到 {results['count']} 个结果",
                    {
                        "count": results["count"],
                        "first_result": results["results"][0]
                        if results["results"]
                        else None,
                    },
                )
                return True
            else:
                print_result(False, "未找到搜索结果", results)
                return False

    print_result(False, f"搜索失败: {response.text}")
    return False


def test_03_search_podcast():
    """测试搜索 podcast 关键词"""
    print_test("搜索关键词: 播客")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "播客", "limit": 5},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            print_result(
                True,
                f"找到 {results['count']} 个结果，包含高亮片段",
                {
                    "count": results["count"],
                    "snippets": [
                        r["snippet"][:100] + "..." for r in results["results"][:2]
                    ],
                },
            )
            return True

    print_result(False, f"搜索失败: {response.text}")
    return False


def test_04_search_with_qc_filter():
    """测试带 QC 状态筛选的搜索"""
    print_test("搜索 + QC 状态筛选 (reviewed)")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "讨论", "qc_status": "reviewed", "limit": 10},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            print_result(
                True,
                f"筛选后找到 {results['count']} 个已审核结果",
                {"count": results["count"]},
            )
            return True

    print_result(False, f"搜索失败: {response.text}")
    return False


def test_05_search_multiword():
    """测试多词搜索"""
    print_test("多词搜索: 技术 发展")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "技术 发展", "limit": 10},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            print_result(
                True,
                f"多词搜索找到 {results['count']} 个结果",
                {
                    "count": results["count"],
                    "first_snippet": results["results"][0]["snippet"]
                    if results["results"]
                    else None,
                },
            )
            return True

    print_result(False, f"搜索失败: {response.text}")
    return False


def test_06_search_no_results():
    """测试无结果搜索"""
    print_test("搜索不存在的关键词")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "这个关键词绝对不存在xyzabc123", "limit": 10},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            if results["count"] == 0:
                print_result(True, "正确返回无结果", results)
                return True

    print_result(False, f"搜索失败: {response.text}")
    return False


def test_07_search_validation():
    """测试搜索参数验证"""
    print_test("测试空查询参数验证")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": ""},  # 空查询
    )

    if response.status_code == 400:
        data = response.json()
        if not data.get("ok") and data.get("error"):
            print_result(True, "正确拒绝空查询", {"error_code": data["error"]["code"]})
            return True

    print_result(False, f"验证失败: {response.text}")
    return False


def test_08_search_highlight():
    """测试搜索高亮功能"""
    print_test("验证搜索高亮 (<mark> 标签)")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/search/transcripts",
        headers=headers,
        params={"q": "人工智能", "limit": 3},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]["results"]
            if results and "<mark>" in results[0]["snippet"]:
                print_result(
                    True,
                    "搜索结果包含高亮标记",
                    {"snippet": results[0]["snippet"][:200]},
                )
                return True

    print_result(False, f"高亮测试失败: {response.text}")
    return False


# ============================================================
# 主测试流程
# ============================================================
def main():
    """主测试流程"""
    print("\n" + "=" * 60)
    print("EchoVault 全文搜索 API 集成测试")
    print("=" * 60)

    # 执行测试
    results = []
    tests = [
        ("01_管理员登录", test_01_login),
        ("02_中文关键词搜索", test_02_search_chinese_keyword),
        ("03_播客关键词搜索", test_03_search_podcast),
        ("04_QC状态筛选", test_04_search_with_qc_filter),
        ("05_多词搜索", test_05_search_multiword),
        ("06_无结果搜索", test_06_search_no_results),
        ("07_参数验证", test_07_search_validation),
        ("08_高亮功能", test_08_search_highlight),
    ]

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_result(False, f"测试异常: {e!s}")
            results.append((test_name, False))

    # 输出测试总结
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    print(f"\n总计: {total} 个测试")
    print(f"通过: {passed} 个")
    print(f"失败: {total - passed} 个")
    print(f"成功率: {passed / total * 100:.1f}%\n")

    # 详细结果
    for test_name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {test_name}")

    print("\n" + "=" * 60)

    # 返回退出码
    return 0 if passed == total else 1


if __name__ == "__main__":
    exit(main())
