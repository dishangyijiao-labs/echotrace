#!/usr/bin/env python
"""
资源中心 API 集成测试脚本
测试文件导入、媒体文件 CRUD、标签管理、任务管理等功能
"""

import json
import sys
import tempfile
import time
from pathlib import Path

import requests

# 配置
BASE_URL = "http://127.0.0.1:8000/api"
TEST_USER = {
    "username": "editor_alice",
    "email": "alice@echovault.dev",
    "password": "alice123",
    "role": "editor",
}
ADMIN_USER = {"email": "admin@echovault.dev", "password": "admin123"}
VIEWER_USER = {"email": "charlie@echovault.dev", "password": "charlie123"}

# 全局变量
access_token = None
admin_token = None
test_media_id = None
test_job_id = None
test_tag_id = None
test_file_path = None


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


def create_test_media_files():
    """创建测试媒体文件"""
    global test_file_path

    # 创建临时目录
    timestamp = int(time.time())
    temp_dir = Path(tempfile.gettempdir()) / f"echovault_test_{timestamp}"
    temp_dir.mkdir(exist_ok=True)

    # 创建测试音频文件（使用唯一内容以生成不同的hash）
    test_file = temp_dir / f"test_audio_{timestamp}.mp3"
    test_file.write_bytes(f"Test MP3 file {timestamp} - unique content".encode() * 1000)

    # 创建测试视频文件
    test_video = temp_dir / f"test_video_{timestamp}.mp4"
    test_video.write_bytes(
        f"Test MP4 file {timestamp} - unique content".encode() * 2000
    )

    test_file_path = str(test_file)

    print("✅ 创建测试文件:")
    print(f"   音频: {test_file}")
    print(f"   视频: {test_video}")

    return temp_dir


def cleanup_test_files(temp_dir):
    """清理测试文件"""
    import shutil

    if temp_dir.exists():
        shutil.rmtree(temp_dir)
        print(f"✅ 清理测试目录: {temp_dir}")


# ============================================================
# 测试 1: 用户登录获取 Token
# ============================================================
def test_01_login():
    """测试编辑器用户登录"""
    global access_token

    print_test("编辑器用户登录")

    response = requests.post(
        f"{BASE_URL}/auth/signin",
        json={"email": TEST_USER["email"], "password": TEST_USER["password"]},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            access_token = data["data"]["access"]
            print_result(True, "登录成功", data["data"])
            return True

    print_result(False, f"登录失败: {response.text}")
    return False


def test_02_admin_login():
    """测试管理员登录"""
    global admin_token

    print_test("管理员登录")

    response = requests.post(
        f"{BASE_URL}/auth/signin",
        json={"email": ADMIN_USER["email"], "password": ADMIN_USER["password"]},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            admin_token = data["data"]["access"]
            print_result(True, "管理员登录成功", data["data"])
            return True

    print_result(False, f"管理员登录失败: {response.text}")
    return False


# ============================================================
# 测试 2: 标签管理
# ============================================================
def test_03_create_tag():
    """测试创建标签"""
    global test_tag_id

    print_test("创建标签")

    timestamp = int(time.time())
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(
        f"{BASE_URL}/tags",
        headers=headers,
        json={"name": f"API测试标签_{timestamp}", "color": "#FF5733"},
    )

    if response.status_code == 201:
        data = response.json()
        # 检查是否是wrapped格式
        if data.get("ok"):
            test_tag_id = data["data"]["id"]
            print_result(True, "标签创建成功", data["data"])
            return True
        # 或者是直接的DRF格式
        elif "id" in data:
            test_tag_id = data["id"]
            print_result(True, "标签创建成功", data)
            return True

    print_result(False, f"标签创建失败: {response.text}")
    return False


def test_04_list_tags():
    """测试获取标签列表"""
    print_test("获取标签列表")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/tags", headers=headers)

    if response.status_code == 200:
        data = response.json()
        # 检查是否是wrapped格式
        if data.get("ok"):
            results = data["data"]["results"]
            count = data["data"]["count"]
            if count > 0:
                print_result(
                    True,
                    f"获取到 {count} 个标签",
                    {"count": count, "first_3": results[:3]},
                )
                return True
        # 或者是直接的DRF列表格式
        elif isinstance(data, list) and len(data) > 0:
            print_result(
                True,
                f"获取到 {len(data)} 个标签",
                {"count": len(data), "first_3": data[:3]},
            )
            return True

    print_result(False, f"获取标签列表失败: {response.text}")
    return False


# ============================================================
# 测试 3: 文件导入
# ============================================================
def test_05_import_single_file():
    """测试导入单个文件"""
    global test_media_id

    print_test("导入单个文件")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(
        f"{BASE_URL}/resources/import/scan",
        headers=headers,
        json={
            "path": test_file_path,
            "source_type": "local",
            "media_type_hint": "audio",
            "priority": 1,
            "tags": ["测试标签", "自动导入"],
        },
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            if results["added"] > 0:
                print_result(True, "文件导入成功", results)
                # 需要获取导入的文件 ID，我们会在列表查询中获取
                return True

    print_result(False, f"文件导入失败: {response.text}")
    return False


def test_06_import_duplicate_file():
    """测试导入重复文件（应该被去重）"""
    print_test("导入重复文件（去重测试）")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(
        f"{BASE_URL}/resources/import/scan",
        headers=headers,
        json={
            "path": test_file_path,
            "source_type": "local",
            "media_type_hint": "audio",
        },
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            results = data["data"]
            if results["duplicates"] > 0 and results["added"] == 0:
                print_result(True, "重复文件检测成功，未重复导入", results)
                return True

    print_result(False, f"去重测试失败: {response.text}")
    return False


# ============================================================
# 测试 4: 媒体文件查询
# ============================================================
def test_07_list_media_files():
    """测试获取媒体文件列表"""
    global test_media_id

    print_test("获取媒体文件列表")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/resources", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok") and len(data["data"]["results"]) > 0:
            # 获取第一个媒体文件的 ID
            test_media_id = data["data"]["results"][0]["id"]
            print_result(
                True,
                f"获取到 {data['data']['count']} 个媒体文件",
                data["data"]["results"][0],
            )
            return True

    print_result(False, f"获取媒体文件列表失败: {response.text}")
    return False


def test_08_filter_media_files():
    """测试媒体文件筛选"""
    print_test("筛选媒体文件（按类型）")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(
        f"{BASE_URL}/resources/?media_type=audio&status=pending", headers=headers
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(
                True,
                f"筛选成功，找到 {data['data']['count']} 个文件",
                {"count": data["data"]["count"]},
            )
            return True

    print_result(False, f"筛选失败: {response.text}")
    return False


def test_09_get_media_detail():
    """测试获取媒体文件详情"""
    print_test("获取媒体文件详情")

    if not test_media_id:
        print_result(False, "没有可用的测试媒体 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/resources/{test_media_id}", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "获取详情成功", data["data"])
            return True

    print_result(False, f"获取详情失败: {response.text}")
    return False


# ============================================================
# 测试 5: 媒体文件更新
# ============================================================
def test_10_update_media_tags():
    """测试更新媒体文件标签"""
    print_test("更新媒体文件标签")

    if not test_media_id:
        print_result(False, "没有可用的测试媒体 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.put(
        f"{BASE_URL}/resources/{test_media_id}/tags",
        headers=headers,
        json={"tag_names": ["重要", "待处理", "测试标签"]},
    )

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "标签更新成功", data["data"])
            return True

    print_result(False, f"标签更新失败: {response.text}")
    return False


def test_11_update_media_info():
    """测试更新媒体文件信息"""
    print_test("更新媒体文件信息")

    if not test_media_id:
        print_result(False, "没有可用的测试媒体 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.patch(
        f"{BASE_URL}/resources/{test_media_id}",
        headers=headers,
        json={"filename": "更新后的文件名.mp3"},
    )

    # DRF 返回直接对象
    if response.status_code == 200:
        data = response.json()
        print_result(True, "文件信息更新成功", data)
        return True

    print_result(False, f"文件信息更新失败: {response.text}")
    return False


# ============================================================
# 测试 6: 任务管理
# ============================================================
def test_12_list_jobs():
    """测试获取任务列表"""
    global test_job_id

    print_test("获取任务列表")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/jobs", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok") and len(data["data"]["results"]) > 0:
            # 获取第一个任务的 ID
            test_job_id = data["data"]["results"][0]["id"]
            print_result(
                True,
                f"获取到 {data['data']['count']} 个任务",
                data["data"]["results"][0],
            )
            return True

    print_result(False, f"获取任务列表失败: {response.text}")
    return False


def test_13_get_job_detail():
    """测试获取任务详情"""
    print_test("获取任务详情")

    if not test_job_id:
        print_result(False, "没有可用的测试任务 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/jobs/{test_job_id}", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "获取任务详情成功", data["data"])
            return True

    print_result(False, f"获取任务详情失败: {response.text}")
    return False


def test_14_cancel_job():
    """测试取消任务"""
    print_test("取消任务")

    if not test_job_id:
        print_result(False, "没有可用的测试任务 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(f"{BASE_URL}/jobs/{test_job_id}/cancel", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "任务取消成功", data["data"])
            return True
    elif response.status_code == 400:
        # 任务可能已经不是 pending/processing 状态
        data = response.json()
        print_result(True, "任务状态不允许取消（预期行为）", data.get("error"))
        return True

    print_result(False, f"任务取消失败: {response.text}")
    return False


def test_15_retry_job():
    """测试重试任务"""
    print_test("重试任务")

    if not test_job_id:
        print_result(False, "没有可用的测试任务 ID")
        return False

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(f"{BASE_URL}/jobs/{test_job_id}/retry", headers=headers)

    # 重试可能会失败（如果任务不是 failed 状态）
    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "任务重试成功，创建新任务", data["data"])
            return True
    elif response.status_code == 400:
        data = response.json()
        print_result(True, "任务状态不允许重试（预期行为）", data.get("error"))
        return True

    print_result(False, f"任务重试失败: {response.text}")
    return False


# ============================================================
# 测试 7: 统计信息
# ============================================================
def test_16_get_stats():
    """测试获取统计信息"""
    print_test("获取统计信息")

    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.get(f"{BASE_URL}/resources/stats", headers=headers)

    if response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "获取统计信息成功", data["data"])
            return True

    print_result(False, f"获取统计信息失败: {response.text}")
    return False


# ============================================================
# 测试 8: 权限控制
# ============================================================
def test_17_viewer_cannot_import():
    """测试 Viewer 角色无法导入文件"""
    print_test("Viewer 角色权限测试（应拒绝导入）")

    # 使用 viewer 账户登录
    response = requests.post(
        f"{BASE_URL}/auth/signin",
        json={"email": VIEWER_USER["email"], "password": VIEWER_USER["password"]},
    )

    if response.status_code != 200:
        print_result(False, "Viewer 登录失败")
        return False

    viewer_token = response.json()["data"]["access"]

    # 尝试导入文件
    headers = {"Authorization": f"Bearer {viewer_token}"}
    response = requests.post(
        f"{BASE_URL}/resources/import/scan",
        headers=headers,
        json={"path": test_file_path, "source_type": "local"},
    )

    # 应该返回 403 Forbidden
    if response.status_code == 403:
        print_result(True, "Viewer 权限控制正确，拒绝导入操作", {"status": 403})
        return True

    print_result(False, f"权限控制失败，Viewer 不应有导入权限: {response.text}")
    return False


def test_18_delete_tag():
    """测试删除标签（仅管理员）"""
    print_test("删除标签（管理员权限）")

    if not test_tag_id:
        print_result(False, "没有可用的测试标签 ID")
        return False

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.delete(f"{BASE_URL}/tags/{test_tag_id}", headers=headers)

    if response.status_code == 204:
        print_result(True, "标签删除成功（管理员权限）", {"status": 204})
        return True
    elif response.status_code == 200:
        data = response.json()
        if data.get("ok"):
            print_result(True, "标签删除成功", data)
            return True

    print_result(False, f"标签删除失败: {response.text}")
    return False


# ============================================================
# 主测试流程
# ============================================================
def main():
    """主测试流程"""
    print("\n" + "=" * 60)
    print("EchoVault 资源中心 API 集成测试")
    print("=" * 60)

    # 创建测试文件
    temp_dir = create_test_media_files()

    # 执行测试
    results = []
    tests = [
        ("01_登录编辑器用户", test_01_login),
        ("02_登录管理员用户", test_02_admin_login),
        ("03_创建标签", test_03_create_tag),
        ("04_获取标签列表", test_04_list_tags),
        ("05_导入单个文件", test_05_import_single_file),
        ("06_导入重复文件（去重）", test_06_import_duplicate_file),
        ("07_获取媒体文件列表", test_07_list_media_files),
        ("08_筛选媒体文件", test_08_filter_media_files),
        ("09_获取媒体文件详情", test_09_get_media_detail),
        ("10_更新媒体文件标签", test_10_update_media_tags),
        ("11_更新媒体文件信息", test_11_update_media_info),
        ("12_获取任务列表", test_12_list_jobs),
        ("13_获取任务详情", test_13_get_job_detail),
        ("14_取消任务", test_14_cancel_job),
        ("15_重试任务", test_15_retry_job),
        ("16_获取统计信息", test_16_get_stats),
        ("17_Viewer权限测试", test_17_viewer_cannot_import),
        ("18_删除标签（管理员）", test_18_delete_tag),
    ]

    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_result(False, f"测试异常: {e!s}")
            results.append((test_name, False))

    # 清理测试文件
    cleanup_test_files(temp_dir)

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
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
