from django.contrib.auth.models import User
from django.test import TestCase

from media.models import MediaFile
from transcripts.models import Transcript, TranscriptVersion


class TranscriptModelTest(TestCase):
    """测试 Transcript 模型"""

    def setUp(self):
        self.user1 = User.objects.create_user(
            username="user1", email="user1@test.com", password="testpass"
        )
        self.user2 = User.objects.create_user(
            username="user2", email="user2@test.com", password="testpass"
        )
        self.media = MediaFile.objects.create(
            filename="test.mp3",
            file_path="/test/test.mp3",
            source_type="local",
            media_type="audio",
            owner=self.user1,
            file_hash="transcript_test_hash",
        )

    def test_transcript_creation(self):
        """测试转录创建"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)
        self.assertEqual(transcript.qc_status, "unreviewed")
        self.assertEqual(transcript.char_count, 0)
        self.assertIsNone(transcript.current_version)

    def test_create_version(self):
        """测试创建版本"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)
        content = "这是第一个版本的内容。"
        version = transcript.create_version(self.user1, content)

        self.assertEqual(version.version_no, 1)
        self.assertEqual(version.content, content)
        self.assertEqual(transcript.current_version, version)
        self.assertEqual(transcript.char_count, len(content))
        self.assertEqual(transcript.summary, content[:200])

    def test_multiple_versions(self):
        """测试多版本创建"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)

        # 创建版本 1
        content1 = "第一版内容"
        version1 = transcript.create_version(self.user1, content1)
        self.assertEqual(version1.version_no, 1)

        # 创建版本 2
        content2 = "第二版内容,已修改"
        version2 = transcript.create_version(self.user2, content2)
        self.assertEqual(version2.version_no, 2)
        self.assertEqual(transcript.current_version, version2)

        # 验证版本数量
        self.assertEqual(transcript.version_count, 2)

    def test_rollback_version(self):
        """测试版本回滚"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)

        # 创建两个版本
        version1 = transcript.create_version(self.user1, "版本1")
        version2 = transcript.create_version(self.user2, "版本2")

        # 确认当前版本是 version2
        self.assertEqual(transcript.current_version, version2)

        # 回滚到 version1
        transcript.rollback_to_version(version1.id)
        transcript.refresh_from_db()
        self.assertEqual(transcript.current_version, version1)
        self.assertEqual(transcript.summary, "版本1")

    def test_mark_reviewed(self):
        """测试标记为已校对"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)
        self.assertEqual(transcript.qc_status, "unreviewed")

        transcript.mark_reviewed()
        transcript.refresh_from_db()
        self.assertEqual(transcript.qc_status, "reviewed")

    def test_current_content_property(self):
        """测试 current_content 属性"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)

        # 没有版本时返回空字符串
        self.assertEqual(transcript.current_content, "")

        # 创建版本后返回内容
        content = "测试内容"
        transcript.create_version(self.user1, content)
        self.assertEqual(transcript.current_content, content)

    def test_one_to_one_relationship(self):
        """测试与 MediaFile 的一对一关系"""
        transcript = Transcript.objects.create(media=self.media, owner=self.user1)

        # 验证关系
        self.assertEqual(self.media.transcript, transcript)
        self.assertTrue(self.media.has_transcript)

        # 尝试创建第二个转录应失败
        with self.assertRaises(Exception):
            Transcript.objects.create(media=self.media, owner=self.user2)


class TranscriptVersionModelTest(TestCase):
    """测试 TranscriptVersion 模型"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", email="test@test.com", password="testpass"
        )
        self.media = MediaFile.objects.create(
            filename="test.mp3",
            file_path="/test/test.mp3",
            source_type="local",
            media_type="audio",
            owner=self.user,
            file_hash="version_test_hash",
        )
        self.transcript = Transcript.objects.create(media=self.media, owner=self.user)

    def test_version_creation(self):
        """测试版本创建"""
        version = TranscriptVersion.objects.create(
            transcript=self.transcript,
            editor=self.user,
            version_no=1,
            content="测试内容",
        )
        self.assertEqual(version.version_no, 1)
        self.assertEqual(version.editor, self.user)

    def test_is_current_property(self):
        """测试 is_current 属性"""
        version1 = TranscriptVersion.objects.create(
            transcript=self.transcript, editor=self.user, version_no=1, content="版本1"
        )
        version2 = TranscriptVersion.objects.create(
            transcript=self.transcript, editor=self.user, version_no=2, content="版本2"
        )

        # 设置 version2 为当前版本
        self.transcript.current_version = version2
        self.transcript.save()

        self.assertFalse(version1.is_current)
        self.assertTrue(version2.is_current)

    def test_char_count_property(self):
        """测试 char_count 属性"""
        content = "这是一段测试文本,用于验证字符计数。"
        version = TranscriptVersion.objects.create(
            transcript=self.transcript, editor=self.user, version_no=1, content=content
        )
        self.assertEqual(version.char_count, len(content))

    def test_unique_constraint(self):
        """测试唯一性约束"""
        TranscriptVersion.objects.create(
            transcript=self.transcript, editor=self.user, version_no=1, content="版本1"
        )

        # 尝试创建相同 version_no 应失败
        with self.assertRaises(Exception):
            TranscriptVersion.objects.create(
                transcript=self.transcript,
                editor=self.user,
                version_no=1,  # 重复
                content="版本1复制",
            )
