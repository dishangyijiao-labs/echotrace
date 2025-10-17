"""
测试认证 API 的脚本
运行方式: python test_auth.py
"""

import json

import requests

BASE_URL = "http://localhost:8000/api"


def print_response(title, response):
    """格式化输出响应"""
    print(f"\n{'=' * 60}")
    print(f"📋 {title}")
    print(f"{'=' * 60}")
    print(f"Status: {response.status_code}")
    try:
        data = response.json()
        print(f"Response:\n{json.dumps(data, indent=2, ensure_ascii=False)}")
    except:
        print(f"Response: {response.text}")
    print(f"{'=' * 60}\n")


def test_auth_flow():
    """测试完整认证流程"""

    print("\n🚀 开始测试认证系统...")

    # 1. 注册新用户
    print("\n## 1. 注册新用户 (Editor)")
    signup_data = {
        "username": "test_editor",
        "email": "test_editor@echovault.dev",
        "password": "TestPass123!",
        "password_confirm": "TestPass123!",
        "first_name": "Test",
        "last_name": "Editor",
        "role": "editor",
    }

    response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
    print_response("注册响应", response)

    if response.status_code == 201:
        print("✅ 注册成功!")
        data = response.json()
        access_token = data["data"]["access"]
        refresh_token = data["data"]["refresh"]
    else:
        print("❌ 注册失败,可能用户已存在,尝试登录...")
        access_token = None
        refresh_token = None

    # 2. 登录
    print("\n## 2. 登录")
    login_data = {"email": "test_editor@echovault.dev", "password": "TestPass123!"}

    response = requests.post(f"{BASE_URL}/auth/signin", json=login_data)
    print_response("登录响应", response)

    if response.status_code == 200:
        print("✅ 登录成功!")
        data = response.json()
        access_token = data["data"]["access"]
        refresh_token = data["data"]["refresh"]
    else:
        print("❌ 登录失败,停止测试")
        return

    # 3. 获取当前用户信息
    print("\n## 3. 获取当前用户信息")
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print_response("当前用户信息", response)

    if response.status_code == 200:
        print("✅ 获取用户信息成功!")

    # 4. 刷新 Token
    print("\n## 4. 刷新 Token")
    refresh_data = {"refresh": refresh_token}

    response = requests.post(f"{BASE_URL}/auth/refresh", json=refresh_data)
    print_response("刷新 Token 响应", response)

    if response.status_code == 200:
        print("✅ Token 刷新成功!")
        data = response.json()
        new_access_token = data["access"]

    # 5. 使用已存在的 admin_user 测试用户列表
    print("\n## 5. 使用 Admin 账户测试用户列表")
    login_data_admin = {"email": "admin@echovault.dev", "password": "admin123"}

    response = requests.post(f"{BASE_URL}/auth/signin", json=login_data_admin)

    if response.status_code == 200:
        data = response.json()
        admin_token = data["data"]["access"]
        print("✅ Admin 登录成功!")

        # 获取用户列表
        headers_admin = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/users", headers=headers_admin)
        print_response("用户列表 (Admin)", response)

        if response.status_code == 200:
            print("✅ 获取用户列表成功!")
    else:
        print("❌ Admin 登录失败 (可能没有运行 seed_testdata)")

    # 6. 测试权限 - Editor 尝试访问用户列表 (应该失败)
    print("\n## 6. 测试权限 - Editor 尝试访问用户列表")
    headers = {"Authorization": f"Bearer {access_token}"}

    response = requests.get(f"{BASE_URL}/users", headers=headers)
    print_response("Editor 访问用户列表", response)

    if response.status_code == 403:
        print("✅ 权限控制正常! Editor 无法访问用户列表")
    else:
        print("❌ 权限控制异常!")

    # 7. 测试无效 Token
    print("\n## 7. 测试无效 Token")
    headers_invalid = {"Authorization": "Bearer invalid_token_here"}

    response = requests.get(f"{BASE_URL}/auth/me", headers=headers_invalid)
    print_response("无效 Token 响应", response)

    if response.status_code == 401:
        print("✅ 无效 Token 正确拒绝!")

    print("\n" + "=" * 60)
    print("🎉 认证系统测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════╗
║           EchoVault 认证系统测试                         ║
╚══════════════════════════════════════════════════════════╝

⚠️  请确保:
1. Django 服务器正在运行 (python manage.py runserver)
2. 已运行过 seed_testdata 命令创建测试用户
3. 端口 8000 可用

开始测试...
""")

    try:
        test_auth_flow()
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务器")
        print("请确保 Django 服务器正在运行:")
        print("  cd backend")
        print("  source venv/bin/activate")
        print("  python manage.py runserver")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback

        traceback.print_exc()
