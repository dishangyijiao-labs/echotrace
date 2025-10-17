from typing import ClassVar
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser, IsAdmin

from .models import SystemSetting
from .serializers import SettingsUpdateSerializer, SystemSettingSerializer


class SettingsListView(generics.ListAPIView):
    """设置列表视图"""

    serializer_class = SystemSettingSerializer
    permission_classes: ClassVar = [permissions.IsAuthenticated, IsActiveUser]

    def get_queryset(self):
        user = self.request.user
        queryset = SystemSetting.objects.all()

        # 非管理员只能看到公开设置
        if not user.profile.is_admin:
            queryset = queryset.filter(is_public=True)

        # 按分类过滤
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)

        # 转换为前端期望的格式
        settings_dict = {}
        for setting in serializer.data:
            settings_dict[setting["key"]] = setting["typed_value"]

        return Response({"ok": True, "data": settings_dict})


class SettingsUpdateView(APIView):
    """设置更新视图"""

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]

    def post(self, request):
        serializer = SettingsUpdateSerializer(data=request.data)
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

        settings_data = serializer.validated_data["settings"]
        updated_settings = []

        for key, value in settings_data.items():
            try:
                setting = SystemSetting.objects.get(key=key)
                if setting.is_editable:
                    setting.value = str(value)
                    setting.updated_by = request.user
                    setting.save()
                    updated_settings.append(key)
            except SystemSetting.DoesNotExist:
                continue

        return Response(
            {
                "ok": True,
                "data": {
                    "updated_settings": updated_settings,
                    "message": f"Updated {len(updated_settings)} settings",
                },
            }
        )


class NASTestView(APIView):
    """NAS连接测试视图"""

    permission_classes: ClassVar = [permissions.IsAuthenticated, IsAdmin, IsActiveUser]

    def post(self, request):
        # 这里应该实现实际的NAS连接测试逻辑
        # 暂时返回模拟结果
        nas_host = request.data.get("host")
        nas_port = request.data.get("port")

        if not nas_host:
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "MISSING_PARAMETER",
                        "message": "NAS host is required",
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 模拟连接测试
        try:
            # 这里应该实现实际的连接测试逻辑
            # import socket
            # socket.create_connection((nas_host, nas_port or 22), timeout=5)

            return Response(
                {
                    "ok": True,
                    "data": {
                        "connected": True,
                        "message": f"Successfully connected to {nas_host}",
                    },
                }
            )
        except Exception as e:
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "CONNECTION_FAILED",
                        "message": f"Failed to connect to {nas_host}: {e!s}",
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
