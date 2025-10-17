from typing import ClassVar

from rest_framework import serializers

from .models import Activity, ActivitySummary


class ActivitySerializer(serializers.ModelSerializer):
    """活动日志序列化器"""

    username = serializers.CharField(source="user.username", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)
    level_display = serializers.CharField(source="get_level_display", read_only=True)

    class Meta:
        model: ClassVar = Activity
        fields: ClassVar = [
            "id",
            "user",
            "username",
            "action",
            "action_display",
            "level",
            "level_display",
            "description",
            "details",
            "content_type",
            "object_id",
            "ip_address",
            "user_agent",
            "timestamp",
        ]
        read_only_fields: ClassVar = ["id", "timestamp"]


class ActivityCreateSerializer(serializers.ModelSerializer):
    """活动日志创建序列化器"""

    class Meta:
        model: ClassVar = Activity
        fields: ClassVar = [
            "action",
            "level",
            "description",
            "details",
            "content_type",
            "object_id",
        ]

    def create(self, validated_data):
        # 从请求中获取用户和IP信息
        request = self.context.get("request")
        if request:
            validated_data["user"] = request.user
            validated_data["ip_address"] = self.get_client_ip(request)
            validated_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")

        return super().create(validated_data)

    def get_client_ip(self, request):
        """获取客户端IP地址"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip


class ActivitySummarySerializer(serializers.ModelSerializer):
    """活动统计摘要序列化器"""

    username = serializers.CharField(source="user.username", read_only=True)
    period_display = serializers.CharField(source="get_period_display", read_only=True)

    class Meta:
        model: ClassVar = ActivitySummary
        fields: ClassVar = [
            "id",
            "period",
            "period_display",
            "date",
            "hour",
            "user",
            "username",
            "total_activities",
            "create_count",
            "update_count",
            "delete_count",
            "upload_count",
            "download_count",
            "transcribe_count",
            "login_count",
            "error_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = ["id", "created_at", "updated_at"]


class UserActivityStatsSerializer(serializers.Serializer):
    """用户活动统计序列化器"""

    user_id = serializers.IntegerField()
    username = serializers.CharField()
    total_activities = serializers.IntegerField()
    recent_activities = serializers.IntegerField()
    last_activity = serializers.DateTimeField()
    most_common_action = serializers.CharField()
    error_rate = serializers.FloatField()


class ActivityTrendSerializer(serializers.Serializer):
    """活动趋势序列化器"""

    date = serializers.DateField()
    total_count = serializers.IntegerField()
    create_count = serializers.IntegerField()
    update_count = serializers.IntegerField()
    delete_count = serializers.IntegerField()
    upload_count = serializers.IntegerField()
    download_count = serializers.IntegerField()
    transcribe_count = serializers.IntegerField()
    error_count = serializers.IntegerField()
