"""
Views for accounts app - Authentication & User Management
"""

from typing import ClassVar

from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.permissions import IsActiveUser, IsAdmin
from accounts.serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetSerializer,
    UserCreateSerializer,
    UserRoleUpdateSerializer,
    UserSerializer,
    UserStatusUpdateSerializer,
    UserUpdateSerializer,
)
from audit.models import ActivityLog


def get_tokens_for_user(user):
    """为用户生成 JWT tokens"""
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


class SignupView(APIView):
    """
    用户注册
    POST /api/auth/signup
    """

    permission_classes: ClassVar = [permissions.AllowAny]

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # 记录审计日志
            ActivityLog.log(
                event="signup",
                actor=user,
                details={
                    "username": user.username,
                    "email": user.email,
                    "role": user.profile.role,
                },
                request=request,
            )

            # 返回用户信息和 token
            tokens = get_tokens_for_user(user)
            user_data = UserSerializer(user).data

            return Response(
                {"ok": True, "data": {"user": user_data, **tokens}},
                status=status.HTTP_201_CREATED,
            )

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class SigninView(APIView):
    """
    用户登录
    POST /api/auth/signin
    """

    permission_classes: ClassVar = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Invalid input",
                        "details": serializer.errors,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]

        # 通过邮箱查找用户
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "AUTH_FAILED",
                        "message": "Invalid email or password",
                    },
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 验证密码
        if not user.check_password(password):
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "AUTH_FAILED",
                        "message": "Invalid email or password",
                    },
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # 检查账户是否激活
        if not user.profile.is_active:
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "ACCOUNT_DISABLED",
                        "message": "Your account has been deactivated",
                    },
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # 记录审计日志
        ActivityLog.log(
            event="signin", actor=user, details={"email": email}, request=request
        )

        # 返回 token
        tokens = get_tokens_for_user(user)
        user_data = UserSerializer(user).data

        return Response({"ok": True, "data": {"user": user_data, **tokens}})


class MeView(APIView):
    """
    获取当前用户信息
    GET /api/auth/me
    """

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsActiveUser]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({"ok": True, "data": serializer.data})

    def put(self, request):
        """更新当前用户信息"""
        serializer = UserUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"ok": True, "data": UserSerializer(request.user).data})

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class ChangePasswordView(APIView):
    """
    修改密码(需要旧密码)
    POST /api/auth/change-password
    """

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsActiveUser]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            request.user.set_password(serializer.validated_data["new_password"])
            request.user.save()

            # 记录审计日志
            ActivityLog.log(
                event="password_change",
                actor=request.user,
                details={"success": True},
                request=request,
            )

            return Response(
                {"ok": True, "data": {"message": "Password changed successfully"}}
            )

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class UserListView(generics.ListAPIView):
    """
    用户列表 (Admin only)
    GET /api/users?role=&is_active=&page=
    """

    serializer_class = UserSerializer
    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]
    queryset = User.objects.all().order_by("-date_joined")

    def get_queryset(self):
        queryset = super().get_queryset()

        # 按角色过滤
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(profile__role=role)

        # 按状态过滤
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            is_active_bool = is_active.lower() in ["true", "1", "yes"]
            queryset = queryset.filter(profile__is_active=is_active_bool)

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return Response({"ok": True, "data": response.data})


class UserDetailView(generics.RetrieveAPIView):
    """
    用户详情 (Admin only)
    GET /api/users/{id}
    """

    serializer_class = UserSerializer
    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]
    queryset = User.objects.all()

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        return Response({"ok": True, "data": response.data})


class UserRoleUpdateView(APIView):
    """
    更新用户角色 (Admin only)
    PUT /api/users/{id}/role
    """

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]

    def put(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {
                    "ok": False,
                    "error": {"code": "USER_NOT_FOUND", "message": "User not found"},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UserRoleUpdateSerializer(data=request.data)
        if serializer.is_valid():
            old_role = user.profile.role
            new_role = serializer.validated_data["role"]

            user.profile.role = new_role
            user.profile.save()

            # 记录审计日志
            ActivityLog.log(
                event="role_update",
                actor=request.user,
                target=user,
                details={"old_role": old_role, "new_role": new_role},
                request=request,
            )

            return Response({"ok": True, "data": UserSerializer(user).data})

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class UserStatusUpdateView(APIView):
    """
    启用/停用用户 (Admin only)
    PUT /api/users/{id}/status
    """

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]

    def put(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {
                    "ok": False,
                    "error": {"code": "USER_NOT_FOUND", "message": "User not found"},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # 防止停用自己
        if user == request.user:
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "CANNOT_DEACTIVATE_SELF",
                        "message": "You cannot deactivate your own account",
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UserStatusUpdateSerializer(data=request.data)
        if serializer.is_valid():
            old_status = user.profile.is_active
            new_status = serializer.validated_data["is_active"]

            user.profile.is_active = new_status
            user.profile.save()

            # 记录审计日志
            ActivityLog.log(
                event="status_update",
                actor=request.user,
                target=user,
                details={"old_status": old_status, "new_status": new_status},
                request=request,
            )

            return Response({"ok": True, "data": UserSerializer(user).data})

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class UserPasswordResetView(APIView):
    """
    重置用户密码 (Admin only)
    POST /api/users/{id}/reset-password
    """

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {
                    "ok": False,
                    "error": {"code": "USER_NOT_FOUND", "message": "User not found"},
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            user.set_password(serializer.validated_data["new_password"])
            user.save()

            # 记录审计日志
            ActivityLog.log(
                event="password_reset",
                actor=request.user,
                target=user,
                details={"reset_by_admin": True},
                request=request,
            )

            return Response(
                {"ok": True, "data": {"message": "Password reset successfully"}}
            )

        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
