"""
Serializers for accounts app
"""

from typing import ClassVar

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.validators import UniqueValidator

from accounts.models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    """用户 Profile 序列化器"""

    class Meta:
        model: ClassVar = UserProfile
        fields: ClassVar = ["role", "is_active", "created_at", "updated_at"]
        read_only_fields: ClassVar = ["created_at", "updated_at"]


class UserSerializer(serializers.ModelSerializer):
    """用户序列化器(用于列表/详情)"""

    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source="profile.role", read_only=True)
    is_admin = serializers.BooleanField(source="profile.is_admin", read_only=True)

    class Meta:
        model: ClassVar = User
        fields: ClassVar = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "date_joined",
            "profile",
            "role",  # 快捷访问
            "is_admin",  # 前端需要的字段
        ]
        read_only_fields: ClassVar = ["id", "date_joined"]


class UserCreateSerializer(serializers.ModelSerializer):
    """用户注册序列化器"""

    email = serializers.EmailField(
        required=True, validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    password_confirm = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )
    role = serializers.ChoiceField(
        choices=UserProfile.ROLE_CHOICES, default="viewer", write_only=True
    )

    class Meta:
        model: ClassVar = User
        fields: ClassVar = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "role",
        ]

    def validate(self, attrs):
        """验证密码一致性"""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "两次输入的密码不一致"}
            )
        return attrs

    def create(self, validated_data):
        """创建用户"""
        # 移除不需要的字段
        validated_data.pop("password_confirm")
        role = validated_data.pop("role", "viewer")

        # 创建用户
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )

        # 设置角色
        user.profile.role = role
        user.profile.save()

        return user


class LoginSerializer(serializers.Serializer):
    """登录序列化器"""

    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        required=True, write_only=True, style={"input_type": "password"}
    )


class UserUpdateSerializer(serializers.ModelSerializer):
    """用户更新序列化器"""

    class Meta:
        model: ClassVar = User
        fields: ClassVar = ["first_name", "last_name", "email"]

    def validate_email(self, value):
        """验证邮箱唯一性"""
        user = self.instance
        if User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("该邮箱已被使用")
        return value


class UserRoleUpdateSerializer(serializers.Serializer):
    """用户角色更新序列化器(Admin only)"""

    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=True)


class UserStatusUpdateSerializer(serializers.Serializer):
    """用户状态更新序列化器(Admin only)"""

    is_active = serializers.BooleanField(required=True)


class PasswordResetSerializer(serializers.Serializer):
    """密码重置序列化器"""

    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password],
        style={"input_type": "password"},
    )
    new_password_confirm = serializers.CharField(
        required=True, write_only=True, style={"input_type": "password"}
    )

    def validate(self, attrs):
        """验证密码一致性"""
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "两次输入的密码不一致"}
            )
        return attrs


class PasswordChangeSerializer(PasswordResetSerializer):
    """密码修改序列化器(需要旧密码)"""

    old_password = serializers.CharField(
        required=True, write_only=True, style={"input_type": "password"}
    )

    def validate_old_password(self, value):
        """验证旧密码"""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("旧密码不正确")
        return value
