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
    nas_directories = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()
    duration = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    version = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()

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
            "nas_directories",
            "filename",
            "duration",
            "content",
            "version",
            "language",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_version_count(self, obj):
        return obj.versions.count()
    
    def get_nas_directories(self, obj):
        """获取NAS目录信息"""
        if not obj.media:
            return []
        
        filename = obj.media.filename
        # 这里可以从配置或数据库中获取NAS目录信息
        # 目前使用硬编码的示例数据
        return [
            {
                "id": 1,
                "name": "主存储NAS",
                "path": f"/nas/storage/media/{filename}",
                "url": f"smb://nas.company.com/storage/media/{filename}",
                "type": "smb"
            },
            {
                "id": 2,
                "name": "备份NAS",
                "path": f"/nas/backup/media/{filename}",
                "url": f"smb://backup-nas.company.com/backup/media/{filename}",
                "type": "smb"
            }
        ]
    
    def get_filename(self, obj):
        """获取文件名"""
        return obj.media.filename if obj.media else ""
    
    def get_duration(self, obj):
        """获取时长"""
        return obj.media.duration if obj.media else None
    
    def get_content(self, obj):
        """获取当前版本内容"""
        return obj.current_content
    
    def get_version(self, obj):
        """获取当前版本号"""
        return obj.current_version.version_no if obj.current_version else 1
    
    def get_language(self, obj):
        """获取语言"""
        # 这里可以从媒体文件或转录设置中获取语言信息
        return "zh-CN"


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
