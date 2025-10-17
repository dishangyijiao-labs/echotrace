from typing import ClassVar

from django.contrib.auth.models import User
from django.db import models


class Task(models.Model):
    """任务模型"""

    STATUS_CHOICES: ClassVar = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("cancelled", "Cancelled"),
    ]

    TYPE_CHOICES: ClassVar = [
        ("transcription", "Transcription"),
        ("upload", "Upload"),
        ("import", "Import"),
        ("export", "Export"),
    ]

    PRIORITY_CHOICES: ClassVar = [
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    ]

    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    priority = models.CharField(
        max_length=10, choices=PRIORITY_CHOICES, default="normal"
    )

    # 任务详情
    description = models.TextField(blank=True)
    progress = models.IntegerField(default=0)  # 0-100

    # 关联信息
    created_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="created_tasks"
    )
    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tasks",
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # 任务参数和结果
    parameters = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = "tasks_task"
        ordering: ClassVar = ["-created_at"]
        indexes: ClassVar = [
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["type", "status"]),
            models.Index(fields=["created_by", "status"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"
