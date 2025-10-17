from typing import ClassVar

from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Activity(models.Model):
    """活动日志模型"""

    ACTION_CHOICES: ClassVar = [
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
        ("upload", "Upload"),
        ("download", "Download"),
        ("transcribe", "Transcribe"),
        ("login", "Login"),
        ("logout", "Logout"),
        ("view", "View"),
        ("search", "Search"),
        ("export", "Export"),
        ("import", "Import"),
        ("schedule", "Schedule"),
        ("run", "Run"),
        ("pause", "Pause"),
        ("resume", "Resume"),
        ("cancel", "Cancel"),
        ("approve", "Approve"),
        ("reject", "Reject"),
    ]

    LEVEL_CHOICES: ClassVar = [
        ("info", "Info"),
        ("warning", "Warning"),
        ("error", "Error"),
        ("success", "Success"),
    ]

    # 基本信息
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="user_activities"
    )
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default="info")

    # 描述信息
    description = models.TextField()
    details = models.JSONField(default=dict, blank=True)

    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey("content_type", "object_id")

    # 请求信息
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)

    # 时间信息
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table: ClassVar = "activities_activity"
        ordering: ClassVar = ["-timestamp"]
        indexes: ClassVar = [
            models.Index(fields=["user", "timestamp"]),
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["level", "timestamp"]),
            models.Index(fields=["content_type", "object_id"]),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.get_action_display()} - {self.timestamp}"


class ActivitySummary(models.Model):
    """活动统计摘要模型"""

    PERIOD_CHOICES: ClassVar = [
        ("hourly", "Hourly"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("monthly", "Monthly"),
    ]

    # 统计周期
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    date = models.DateField()
    hour = models.IntegerField(null=True, blank=True)  # 仅用于小时统计

    # 用户信息
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)

    # 统计数据
    total_activities = models.IntegerField(default=0)
    create_count = models.IntegerField(default=0)
    update_count = models.IntegerField(default=0)
    delete_count = models.IntegerField(default=0)
    upload_count = models.IntegerField(default=0)
    download_count = models.IntegerField(default=0)
    transcribe_count = models.IntegerField(default=0)
    login_count = models.IntegerField(default=0)
    error_count = models.IntegerField(default=0)

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table: ClassVar = "activities_activitysummary"
        unique_together: ClassVar = [
            ["period", "date", "hour", "user"],
        ]
        indexes: ClassVar = [
            models.Index(fields=["period", "date"]),
            models.Index(fields=["user", "period", "date"]),
        ]

    def __str__(self):
        user_str = self.user.username if self.user else "All Users"
        if self.hour is not None:
            return f"{user_str} - {self.period} - {self.date} {self.hour}:00"
        return f"{user_str} - {self.period} - {self.date}"
