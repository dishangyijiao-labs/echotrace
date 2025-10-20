from typing import ClassVar

from rest_framework import serializers

from .models import Schedule, ScheduleRun


class ScheduleSerializer(serializers.ModelSerializer):
    """调度任务序列化器"""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True
    )
    # 为last_run添加嵌套的ScheduleRun对象
    last_run_info = serializers.SerializerMethodField()

    class Meta:
        model = Schedule
        fields: ClassVar = [
            "id",
            "name",
            "description",
            "schedule_type",
            "time",
            "days_of_week",
            "is_active",
            "settings",
            "created_by",
            "created_by_username",
            "created_at",
            "updated_at",
            "last_run",
            "last_run_info",
            "next_run",
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

    def get_last_run_info(self, obj):
        """获取最后一次执行信息"""
        last_run = obj.runs.first()  # 已经按时间倒序
        if last_run:
            return {
                "status": last_run.status,
                "timestamp": last_run.timestamp,
                "duration": last_run.duration,
                "jobs_created": last_run.jobs_created,
            }
        return None


class ScheduleCreateSerializer(serializers.ModelSerializer):
    """调度任务创建序列化器"""

    class Meta:
        model = Schedule
        fields: ClassVar = [
            "name",
            "description",
            "schedule_type",
            "time",
            "days_of_week",
            "is_active",
            "settings",
        ]

    def create(self, validated_data):
        # 设置创建者为当前用户
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ScheduleRunSerializer(serializers.ModelSerializer):
    """调度执行记录序列化器"""

    schedule_name = serializers.CharField(
        source="schedule.name", read_only=True
    )

    class Meta:
        model = ScheduleRun
        fields: ClassVar = [
            "id",
            "schedule",
            "schedule_name",
            "status",
            "timestamp",
            "duration",
            "jobs_created",
            "error_message",
        ]
        read_only_fields: ClassVar = ["id", "timestamp"]
