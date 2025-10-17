from django.contrib.auth.models import User
from django.test import TestCase


class UserProfileModelTest(TestCase):
    """测试 UserProfile 模型"""

    def setUp(self):
        """测试前准备"""
        self.admin = User.objects.create_user(
            username="testadmin", email="admin@test.com", password="testpass"
        )
        self.admin.profile.role = "admin"
        self.admin.profile.save()

        self.editor = User.objects.create_user(
            username="testeditor", email="editor@test.com", password="testpass"
        )
        self.editor.profile.role = "editor"
        self.editor.profile.save()

        self.viewer = User.objects.create_user(
            username="testviewer", email="viewer@test.com", password="testpass"
        )
        self.viewer.profile.role = "viewer"
        self.viewer.profile.save()

    def test_profile_auto_created(self):
        """测试用户创建时自动创建 Profile"""
        user = User.objects.create_user(
            username="newuser", email="new@test.com", password="testpass"
        )
        self.assertTrue(hasattr(user, "profile"))
        self.assertEqual(user.profile.role, "viewer")  # 默认角色

    def test_is_admin_property(self):
        """测试 is_admin 属性"""
        self.assertTrue(self.admin.profile.is_admin)
        self.assertFalse(self.editor.profile.is_admin)
        self.assertFalse(self.viewer.profile.is_admin)

    def test_is_editor_property(self):
        """测试 is_editor 属性"""
        self.assertTrue(self.admin.profile.is_editor)
        self.assertTrue(self.editor.profile.is_editor)
        self.assertFalse(self.viewer.profile.is_editor)

    def test_can_edit_property(self):
        """测试 can_edit 属性"""
        self.assertTrue(self.admin.profile.can_edit)
        self.assertTrue(self.editor.profile.can_edit)
        self.assertFalse(self.viewer.profile.can_edit)

    def test_can_delete_property(self):
        """测试 can_delete 属性"""
        self.assertTrue(self.admin.profile.can_delete)
        self.assertFalse(self.editor.profile.can_delete)
        self.assertFalse(self.viewer.profile.can_delete)

    def test_profile_str(self):
        """测试 __str__ 方法"""
        expected = f"{self.admin.username} (Admin)"
        self.assertEqual(str(self.admin.profile), expected)
