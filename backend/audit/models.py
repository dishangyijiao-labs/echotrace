from django.contrib.auth.models import User
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class ActivityLog(models.Model):
    """审计日志模型"""

    EVENT_CHOICES = [
        ("signup", "User Signup"),
        ("signin", "User Sign In"),
        ("signout", "User Sign Out"),
        ("upload", "File Upload"),
        ("import", "File Import"),
        ("transcribe", "Start Transcription"),
        ("edit", "Edit Transcript"),
        ("rollback", "Rollback Version"),
        ("mark_qc", "Mark QC Status"),
        ("delete", "Delete Resource"),
        ("update_tags", "Update Tags"),
        ("retry_job", "Retry Job"),
        ("cancel_job", "Cancel Job"),
        ("update_settings", "Update Settings"),
        ("scheduler_run", "Scheduler Run"),
        ("nas_scan", "NAS Scan"),
        ("export", "Export Data"),
    ]

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="activities",
        help_text="操作者(System 为 null)",
    )
    event = models.CharField(max_length=30, choices=EVENT_CHOICES, db_index=True)
    # Generic foreign key to any model
    target_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE, null=True, blank=True
    )
    target_id = models.PositiveIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_type", "target_id")

    details = models.JSONField(
        default=dict, blank=True, help_text="操作详情(JSON 格式)"
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_activitylog"
        verbose_name = "Activity Log"
        verbose_name_plural = "Activity Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["event", "-created_at"]),
            models.Index(fields=["target_type", "target_id"]),
        ]

    def __str__(self):
        actor_name = self.actor.username if self.actor else "System"
        return f"{actor_name} - {self.get_event_display()} at {self.created_at}"

    @property
    def actor_name(self):
        """操作者名称"""
        return self.actor.username if self.actor else "System"

    @classmethod
    def log(cls, event, actor=None, target=None, details=None, request=None):
        """快捷日志记录方法"""
        log_data = {
            "event": event,
            "actor": actor,
            "details": details or {},
        }

        # 如果有目标对象,记录
        if target:
            log_data["target"] = target

        # 如果有 request 对象,提取 IP 和 User Agent
        if request:
            log_data["ip_address"] = cls._get_client_ip(request)
            log_data["user_agent"] = request.META.get("HTTP_USER_AGENT", "")[:255]

        return cls.objects.create(**log_data)

    @staticmethod
    def _get_client_ip(request):
        """从 request 获取客户端 IP"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0]
        else:
            ip = request.META.get("REMOTE_ADDR")
        return ip
