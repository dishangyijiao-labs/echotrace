from typing import ClassVar

from django.contrib.auth.models import User
from django.db import models


class Schedule(models.Model):
    """调度任务模型 - 用于定时自动创建转录任务"""

    SCHEDULE_TYPE_CHOICES: ClassVar = [
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    # 调度配置 - 匹配前端字段
    schedule_type = models.CharField(
        max_length=20, choices=SCHEDULE_TYPE_CHOICES, default="daily"
    )
    time = models.TimeField(
        default="09:00", help_text="执行时间，格式: HH:MM"
    )
    days_of_week = models.JSONField(
        default=list, blank=True, help_text="每周执行的日期 [0-6]，0=周日"
    )
    is_active = models.BooleanField(default=True)

    # 执行参数
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="包含 language, model, auto_process 等配置",
    )

    # 关联信息
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_schedules"
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_run = models.DateTimeField(
        null=True, blank=True, help_text="最后一次执行时间"
    )
    next_run = models.DateTimeField(
        null=True, blank=True, help_text="下次执行时间"
    )

    # 统计信息
    run_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)

    class Meta:
        db_table = "scheduler_schedule"
        indexes: ClassVar = [
            models.Index(fields=["is_active", "next_run"]),
            models.Index(fields=["schedule_type", "is_active"]),
            models.Index(fields=["created_by", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({'活跃' if self.is_active else '暂停'})"


class ScheduleRun(models.Model):
    """调度执行记录模型 - 记录每次自动执行的结果"""

    STATUS_CHOICES: ClassVar = [
        ("success", "Success"),
        ("failed", "Failed"),
    ]

    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="success"
    )

    # 执行信息
    timestamp = models.DateTimeField(auto_now_add=True, help_text="执行时间")
    duration = models.FloatField(
        null=True, blank=True, help_text="执行耗时(秒)"
    )

    # 结果信息
    jobs_created = models.IntegerField(
        default=0, help_text="本次创建的任务数"
    )
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "scheduler_schedulerun"
        ordering: ClassVar = ["-timestamp"]
        indexes: ClassVar = [
            models.Index(fields=["schedule", "status"]),
            models.Index(fields=["timestamp"]),
        ]

    def __str__(self):
        status_display = dict(self.STATUS_CHOICES).get(
            self.status, self.status
        )
        return f"{self.schedule.name} - {self.timestamp} ({status_display})"
