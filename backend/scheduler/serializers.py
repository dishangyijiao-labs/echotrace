from typing import ClassVar

from rest_framework import serializers

from .models import Schedule, ScheduleRun


class ScheduleSerializer(serializers.ModelSerializer):
    """调度任务序列化器"""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )

    class Meta:
        model = Schedule
        fields: ClassVar = [
            "id",
            "name",
            "description",
            "type",
            "status",
            "frequency",
            "cron_expression",
            "start_date",
            "end_date",
            "next_run",
            "last_run",
            "parameters",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "run_count",
            "success_count",
            "failure_count",
        ]
        read_only_fields: ClassVar = [
            "id",
            "created_at",
            "updated_at",
            "next_run",
            "last_run",
            "run_count",
            "success_count",
            "failure_count",
        ]


class ScheduleCreateSerializer(serializers.ModelSerializer):
    """调度任务创建序列化器"""

    class Meta:
        model = Schedule
        fields: ClassVar = [
            "name",
            "description",
            "type",
            "frequency",
            "cron_expression",
            "start_date",
            "end_date",
            "parameters",
        ]

    def create(self, validated_data):
        # 设置创建者为当前用户
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ScheduleRunSerializer(serializers.ModelSerializer):
    """调度执行记录序列化器"""

    schedule_name = serializers.CharField(source="schedule.name", read_only=True)

    class Meta:
        model = ScheduleRun
        fields: ClassVar = [
            "id",
            "schedule",
            "schedule_name",
            "status",
            "started_at",
            "completed_at",
            "duration",
            "result",
            "error_message",
            "log_output",
        ]
        read_only_fields: ClassVar = ["id", "started_at"]
