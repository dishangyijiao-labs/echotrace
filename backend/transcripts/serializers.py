"""
转录文本相关序列化器
"""

from rest_framework import serializers

from accounts.serializers import UserSerializer
from media.serializers import MediaFileSerializer

from .models import Transcript, TranscriptVersion


class TranscriptVersionSerializer(serializers.ModelSerializer):
    """转录版本序列化器"""

    editor = UserSerializer(read_only=True)
    is_current = serializers.BooleanField(read_only=True)
    char_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = TranscriptVersion
        fields = [
            "id",
            "version_no",
            "content",
            "editor",
            "is_current",
            "char_count",
            "created_at",
        ]
        read_only_fields = ["id", "version_no", "created_at"]


class TranscriptSerializer(serializers.ModelSerializer):
    """转录文本序列化器"""

    owner = UserSerializer(read_only=True)
    media = MediaFileSerializer(read_only=True)
    current_content = serializers.CharField(read_only=True)
    version_count = serializers.SerializerMethodField()

    class Meta:
        model = Transcript
        fields = [
            "id",
            "media",
            "owner",
            "qc_status",
            "summary",
            "char_count",
            "current_content",
            "version_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_version_count(self, obj):
        return obj.versions.count()


class SearchResultSerializer(serializers.Serializer):
    """搜索结果序列化器"""

    version_id = serializers.IntegerField()
    version_no = serializers.IntegerField()
    transcript_id = serializers.IntegerField()
    media_id = serializers.IntegerField()
    media_filename = serializers.CharField()
    owner = UserSerializer()
    snippet = serializers.CharField(help_text="高亮片段")
    rank = serializers.FloatField(help_text="相关度评分")
    created_at = serializers.DateTimeField()


class TranscriptSearchSerializer(serializers.Serializer):
    """搜索请求序列化器"""

    q = serializers.CharField(
        required=True, min_length=1, max_length=200, help_text="搜索关键词"
    )
    qc_status = serializers.ChoiceField(
        choices=["all", "unreviewed", "reviewed", "approved"],
        default="all",
        required=False,
        help_text="质检状态筛选",
    )
    owner = serializers.IntegerField(required=False, help_text="所有者用户 ID")
    limit = serializers.IntegerField(
        default=20, min_value=1, max_value=100, required=False, help_text="返回结果数量"
    )
