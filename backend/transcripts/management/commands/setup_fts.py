"""
管理命令: 配置 SQLite FTS5 全文搜索
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "配置 SQLite FTS5 全文搜索表和触发器"

    def add_arguments(self, parser):
        parser.add_argument(
            "--drop", action="store_true", help="删除现有的 FTS 表和触发器（重新创建）"
        )

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            if options["drop"]:
                self.stdout.write("🗑️  删除现有的 FTS 表和触发器...")
                self.drop_fts(cursor)
                self.stdout.write(self.style.SUCCESS("✓ 已删除"))

            self.stdout.write("📝 创建 FTS5 虚拟表...")
            self.create_fts_table(cursor)
            self.stdout.write(self.style.SUCCESS("✓ FTS5 表创建成功"))

            self.stdout.write("🔧 创建同步触发器...")
            self.create_triggers(cursor)
            self.stdout.write(self.style.SUCCESS("✓ 触发器创建成功"))

            self.stdout.write("🔄 同步现有数据到 FTS 表...")
            self.sync_existing_data(cursor)
            self.stdout.write(self.style.SUCCESS("✓ 数据同步完成"))

            # 验证设置
            cursor.execute("SELECT COUNT(*) FROM transcripts_transcriptversion_fts")
            count = cursor.fetchone()[0]
            self.stdout.write(
                self.style.SUCCESS(f"\n✅ FTS5 配置完成! 已索引 {count} 条转录文本")
            )

    def drop_fts(self, cursor):
        """删除现有的 FTS 表和触发器"""
        # 删除触发器
        triggers = [
            "transcriptversion_fts_insert",
            "transcriptversion_fts_update",
            "transcriptversion_fts_delete",
        ]
        for trigger in triggers:
            try:
                cursor.execute(f"DROP TRIGGER IF EXISTS {trigger}")
            except Exception:
                pass

        # 删除 FTS 虚拟表
        try:
            cursor.execute("DROP TABLE IF EXISTS transcripts_transcriptversion_fts")
        except Exception:
            pass

    def create_fts_table(self, cursor):
        """创建 FTS5 虚拟表"""
        # 使用 trigram tokenizer 以支持中文全文搜索
        # trigram 将文本分解为 3 个字符的片段，非常适合没有分词的中文文本
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS
            transcripts_transcriptversion_fts
            USING fts5(
                content,
                content='transcripts_transcriptversion',
                content_rowid='id',
                tokenize='trigram'
            )
        """)

    def create_triggers(self, cursor):
        """创建触发器自动同步数据到 FTS 表"""

        # INSERT 触发器
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS transcriptversion_fts_insert
            AFTER INSERT ON transcripts_transcriptversion
            BEGIN
                INSERT INTO transcripts_transcriptversion_fts(
                    rowid, content
                ) VALUES (
                    new.id, new.content
                );
            END;
        """)

        # UPDATE 触发器
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS transcriptversion_fts_update
            AFTER UPDATE ON transcripts_transcriptversion
            BEGIN
                UPDATE transcripts_transcriptversion_fts
                SET content = new.content
                WHERE rowid = new.id;
            END;
        """)

        # DELETE 触发器
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS transcriptversion_fts_delete
            AFTER DELETE ON transcripts_transcriptversion
            BEGIN
                DELETE FROM transcripts_transcriptversion_fts
                WHERE rowid = old.id;
            END;
        """)

    def sync_existing_data(self, cursor):
        """将现有数据同步到 FTS 表"""
        cursor.execute("""
            INSERT INTO transcripts_transcriptversion_fts(rowid, content)
            SELECT id, content
            FROM transcripts_transcriptversion
        """)
