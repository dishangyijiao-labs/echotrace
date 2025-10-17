from typing import ClassVar

from rest_framework import serializers

from .models import Task


class TaskSerializer(serializers.ModelSerializer):
    """任务序列化器"""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    assigned_to_username = serializers.CharField(
        source="assigned_to.username", read_only=True
    )

    class Meta:
        model = Task
        fields: ClassVar = [
            "id",
            "name",
            "type",
            "status",
            "priority",
            "description",
            "progress",
            "created_by",
            "created_by_username",
            "assigned_to",
            "assigned_to_username",
            "created_at",
            "updated_at",
            "started_at",
            "completed_at",
            "parameters",
            "result",
            "error_message",
        ]
        read_only_fields: ClassVar = ["id", "created_at", "updated_at"]


class TaskCreateSerializer(serializers.ModelSerializer):
    """任务创建序列化器"""

    class Meta:
        model = Task
        fields: ClassVar = [
            "name",
            "type",
            "priority",
            "description",
            "assigned_to",
            "parameters",
        ]

    def create(self, validated_data):
        # 设置创建者为当前用户
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class TaskUpdateSerializer(serializers.ModelSerializer):
    """任务更新序列化器"""

    class Meta:
        model = Task
        fields: ClassVar = [
            "name",
            "status",
            "priority",
            "description",
            "progress",
            "assigned_to",
            "parameters",
            "result",
            "error_message",
        ]
