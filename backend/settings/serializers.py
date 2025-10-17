from typing import ClassVar

from rest_framework import serializers

from .models import SystemSetting


class SystemSettingSerializer(serializers.ModelSerializer):
    """系统设置序列化器"""

    typed_value = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields: ClassVar = [
            "id",
            "key",
            "value",
            "typed_value",
            "value_type",
            "category",
            "name",
            "description",
            "is_public",
            "is_editable",
            "validation_rules",
            "default_value",
            "created_at",
            "updated_at",
        ]
        read_only_fields: ClassVar = ["id", "created_at", "updated_at"]

    def get_typed_value(self, obj):
        return obj.get_typed_value()


class SettingsUpdateSerializer(serializers.Serializer):
    """批量设置更新序列化器"""

    settings = serializers.DictField(
        child=serializers.CharField(), help_text="设置键值对"
    )
