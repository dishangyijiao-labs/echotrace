from typing import ClassVar

from django.contrib.auth.models import User
from django.db import models


class SystemSetting(models.Model):
    """系统设置模型"""

    CATEGORY_CHOICES: ClassVar = [
        ("transcription", "Transcription"),
        ("storage", "Storage"),
        ("system", "System"),
        ("notification", "Notification"),
    ]

    TYPE_CHOICES: ClassVar = [
        ("string", "String"),
        ("integer", "Integer"),
        ("float", "Float"),
        ("boolean", "Boolean"),
        ("json", "JSON"),
    ]

    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    value_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default="string")
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)

    # 元数据
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)  # 是否对普通用户可见
    is_editable = models.BooleanField(default=True)  # 是否可编辑

    # 验证规则
    validation_rules = models.JSONField(default=dict, blank=True)
    default_value = models.TextField(blank=True)

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "settings_systemsetting"
        ordering: ClassVar = ["category", "key"]
        indexes: ClassVar = [
            models.Index(fields=["category", "is_public"]),
            models.Index(fields=["key"]),
        ]

    def __str__(self):
        return f"{self.key} = {self.value}"

    def get_typed_value(self):
        """获取类型化的值"""
        if self.value_type == "integer":
            return int(self.value)
        elif self.value_type == "float":
            return float(self.value)
        elif self.value_type == "boolean":
            return self.value.lower() in ("true", "1", "yes", "on")
        elif self.value_type == "json":
            import json

            return json.loads(self.value)
        else:
            return self.value
