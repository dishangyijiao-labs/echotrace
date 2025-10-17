from typing import ClassVar

from django.contrib.auth.models import User
from django.db import models


class Schedule(models.Model):
    """调度任务模型"""

    TYPE_CHOICES: ClassVar = [
        ("transcription", "Transcription"),
        ("cleanup", "Cleanup"),
        ("backup", "Backup"),
        ("import", "Import"),
    ]

    STATUS_CHOICES: ClassVar = [
        ("active", "Active"),
        ("paused", "Paused"),
        ("disabled", "Disabled"),
    ]

    FREQUENCY_CHOICES: ClassVar = [
        ("once", "Once"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
        ("custom", "Custom"),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")

    # 调度配置
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    cron_expression = models.CharField(max_length=100, blank=True)  # 自定义cron表达式

    # 时间配置
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    next_run = models.DateTimeField(null=True, blank=True)
    last_run = models.DateTimeField(null=True, blank=True)

    # 任务参数
    parameters = models.JSONField(default=dict, blank=True)

    # 关联信息
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_schedules"
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 统计信息
    run_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)

    class Meta:
        db_table = "scheduler_schedule"
        indexes: ClassVar = [
            models.Index(fields=["status", "next_run"]),
            models.Index(fields=["type", "status"]),
            models.Index(fields=["created_by", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class ScheduleRun(models.Model):
    """调度执行记录模型"""

    STATUS_CHOICES: ClassVar = [
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="runs"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="running")

    # 执行信息
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration = models.DurationField(null=True, blank=True)

    # 结果信息
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    log_output = models.TextField(blank=True)

    class Meta:
        db_table = "scheduler_schedulerun"
        ordering: ClassVar = ["-started_at"]
        indexes: ClassVar = [
            models.Index(fields=["schedule", "status"]),
            models.Index(fields=["started_at"]),
        ]

    def __str__(self):
        return f"{self.schedule.name} - {self.started_at} ({self.get_status_display()})"
