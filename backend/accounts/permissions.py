"""
Custom permission classes for EchoVault
"""

from rest_framework import permissions


class IsAdmin(permissions.BasePermission):
    """
    只允许 Admin 角色访问
    """

    message = "Only administrators can perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.is_admin
        )


class IsEditor(permissions.BasePermission):
    """
    只允许 Editor 或更高权限访问 (Admin/Editor)
    """

    message = "You need editor permissions to perform this action."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.can_edit
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Admin 可以进行任何操作,其他用户只能读取
    """

    def has_permission(self, request, view):
        # 允许所有人读取
        if request.method in permissions.SAFE_METHODS:
            return True

        # 只允许 Admin 写入
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.is_admin
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    对象的所有者或 Admin 可以访问
    """

    message = "You can only access your own resources."

    def has_object_permission(self, request, view, obj):
        # Admin 可以访问所有对象
        if request.user.profile.is_admin:
            return True

        # 检查对象是否有 owner 属性
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        # 如果对象本身就是 User
        if isinstance(obj, type(request.user)):
            return obj == request.user

        return False


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    所有人可以读取,只有所有者可以修改
    """

    def has_object_permission(self, request, view, obj):
        # 允许所有人读取
        if request.method in permissions.SAFE_METHODS:
            return True

        # 检查对象是否有 owner 属性
        if hasattr(obj, "owner"):
            return obj.owner == request.user

        return False


class IsActiveUser(permissions.BasePermission):
    """
    只允许活跃用户访问
    """

    message = "Your account has been deactivated."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "profile")
            and request.user.profile.is_active
        )
