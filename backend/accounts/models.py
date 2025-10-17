from typing import ClassVar

from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    """用户扩展表 - 添加角色与状态"""

    ROLE_CHOICES: ClassVar = [
        ("admin", "Admin"),
        ("editor", "Editor"),
        ("viewer", "Viewer"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(
        max_length=10, choices=ROLE_CHOICES, default="viewer", db_index=True
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "accounts_userprofile"
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"
        indexes: ClassVar = [
            models.Index(fields=["role", "is_active"]),
        ]

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == "admin"

    @property
    def is_editor(self):
        return self.role in ["admin", "editor"]

    @property
    def can_edit(self):
        return self.role in ["admin", "editor"]

    @property
    def can_delete(self):
        return self.role == "admin"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """自动为新用户创建 Profile"""
    if created:
        UserProfile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    """保存用户时同步 Profile"""
    if hasattr(instance, "profile"):
        instance.profile.save()
