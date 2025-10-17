from django.contrib.auth.models import User
from django.db import models

from media.models import MediaFile


class Transcript(models.Model):
    """转录文本主表"""

    QC_STATUS_CHOICES = [
        ("unreviewed", "Unreviewed"),
        ("reviewed", "Reviewed"),
    ]

    media = models.OneToOneField(
        MediaFile, on_delete=models.CASCADE, related_name="transcript"
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="transcripts",
        help_text="首次生成转录的用户",
    )
    current_version = models.ForeignKey(
        "TranscriptVersion",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    qc_status = models.CharField(
        max_length=20, choices=QC_STATUS_CHOICES, default="unreviewed", db_index=True
    )
    summary = models.TextField(blank=True, help_text="文本摘要(前200字)")
    char_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transcripts_transcript"
        verbose_name = "Transcript"
        verbose_name_plural = "Transcripts"
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["owner", "qc_status"]),
            models.Index(fields=["-updated_at"]),
        ]

    def __str__(self):
        return f"Transcript for {self.media.filename}"

    @property
    def current_content(self):
        """获取当前版本内容"""
        if self.current_version:
            return self.current_version.content
        return ""

    @property
    def version_count(self):
        """版本数量"""
        return self.versions.count()

    def create_version(self, editor, content):
        """创建新版本"""
        # 计算新版本号
        last_version = self.versions.order_by("-version_no").first()
        new_version_no = (last_version.version_no + 1) if last_version else 1

        # 创建新版本
        version = TranscriptVersion.objects.create(
            transcript=self, editor=editor, version_no=new_version_no, content=content
        )

        # 更新当前版本
        self.current_version = version
        self.summary = content[:200] if content else ""
        self.char_count = len(content)
        self.save(
            update_fields=["current_version", "summary", "char_count", "updated_at"]
        )

        return version

    def rollback_to_version(self, version_id):
        """回滚到指定版本"""
        version = self.versions.get(id=version_id)
        self.current_version = version
        self.summary = version.content[:200] if version.content else ""
        self.char_count = len(version.content)
        self.save(
            update_fields=["current_version", "summary", "char_count", "updated_at"]
        )
        return version

    def mark_reviewed(self):
        """标记为已校对"""
        self.qc_status = "reviewed"
        self.save(update_fields=["qc_status", "updated_at"])

    def mark_unreviewed(self):
        """标记为未校对"""
        self.qc_status = "unreviewed"
        self.save(update_fields=["qc_status", "updated_at"])


class TranscriptVersion(models.Model):
    """转录版本表"""

    transcript = models.ForeignKey(
        Transcript, on_delete=models.CASCADE, related_name="versions"
    )
    editor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="edited_versions",
        help_text="编辑此版本的用户",
    )
    version_no = models.IntegerField()
    content = models.TextField(help_text="完整转录文本")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "transcripts_transcriptversion"
        verbose_name = "Transcript Version"
        verbose_name_plural = "Transcript Versions"
        ordering = ["-version_no"]
        unique_together = [["transcript", "version_no"]]
        indexes = [
            models.Index(fields=["transcript", "-version_no"]),
        ]

    def __str__(self):
        return f"Version {self.version_no} of {self.transcript.media.filename}"

    @property
    def is_current(self):
        """是否为当前版本"""
        return self.transcript.current_version_id == self.id

    @property
    def char_count(self):
        """字符数"""
        return len(self.content)
