"""
转录文本视图
"""

from django.contrib.auth.models import User
from django.db import connection
from django.http import HttpResponse
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsActiveUser
from audit.models import ActivityLog

from .models import Transcript, TranscriptVersion
from .serializers import SearchResultSerializer, TranscriptSearchSerializer, TranscriptSerializer


class TranscriptSearchView(APIView):
    """
    全文搜索转录文本
    GET /api/search/transcripts?q=关键词&qc_status=reviewed&owner=1&limit=20
    """

    permission_classes = [permissions.IsAuthenticated, IsActiveUser]

    def get(self, request):
        # 验证请求参数
        serializer = TranscriptSearchSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "ok": False,
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "Invalid search parameters",
                        "details": serializer.errors,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        params = serializer.validated_data
        query = params["q"]
        qc_status_filter = params.get("qc_status", "all")
        owner_id = params.get("owner")
        limit = params.get("limit", 20)

        # 执行 FTS5 搜索
        results = self._perform_search(query, qc_status_filter, owner_id, limit)

        # 记录审计日志
        ActivityLog.log(
            event="search",
            actor=request.user,
            details={
                "query": query,
                "qc_status": qc_status_filter,
                "results_count": len(results),
            },
            request=request,
        )

        # 序列化结果
        result_serializer = SearchResultSerializer(results, many=True)

        return Response(
            {
                "ok": True,
                "data": {
                    "query": query,
                    "count": len(results),
                    "results": result_serializer.data,
                },
            }
        )

    def _perform_search(self, query, qc_status_filter, owner_id, limit):
        """
        执行 FTS5 全文搜索

        Args:
            query: 搜索关键词
            qc_status_filter: QC 状态筛选
            owner_id: 所有者 ID
            limit: 结果数量限制

        Returns:
            list: 搜索结果列表
        """
        # 使用 connection.connection.cursor() 获取原始数据库游标，绕过 Django 的 debug 包装器
        # 这样可以避免 Django debug 模式下 SQL 格式化导致的错误
        cursor = connection.connection.cursor()
        try:
            # 构建 SQL 查询
            # 注意：不使用 snippet 函数，因为其参数包含 % 符号会导致 Django DEBUG 模式下格式化错误
            # 我们改为在 Python 端截取内容并添加高亮
            sql = """
                SELECT
                    tv.id as version_id,
                    tv.version_no,
                    tv.created_at,
                    tv.content as full_content,
                    t.id as transcript_id,
                    t.qc_status,
                    t.owner_id,
                    m.id as media_id,
                    m.filename as media_filename,
                    rank as rank_score
                FROM transcripts_transcriptversion_fts fts
                JOIN transcripts_transcriptversion tv ON fts.rowid = tv.id
                JOIN transcripts_transcript t ON tv.transcript_id = t.id
                JOIN media_mediafile m ON t.media_id = m.id
                WHERE transcripts_transcriptversion_fts MATCH ?
            """

            # 添加 QC 状态筛选
            if qc_status_filter != "all":
                sql += " AND t.qc_status = ?"

            # 添加所有者筛选
            if owner_id:
                sql += " AND t.owner_id = ?"

            # 按相关度排序并限制结果数
            sql += " ORDER BY rank LIMIT ?"

            # 准备参数（使用元组）
            params = [query]
            if qc_status_filter != "all":
                params.append(qc_status_filter)
            if owner_id:
                params.append(owner_id)
            params.append(limit)

            # 执行查询
            cursor.execute(sql, tuple(params))

            # 获取结果
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()

            # 转换为字典列表
            results = []
            for row in rows:
                result_dict = dict(zip(columns, row))

                # 获取所有者信息
                try:
                    owner = User.objects.get(id=result_dict["owner_id"])
                    from accounts.serializers import UserSerializer

                    owner_data = UserSerializer(owner).data
                except User.DoesNotExist:
                    owner_data = None

                # 生成高亮摘要片段
                full_content = result_dict["full_content"]
                snippet = self._generate_snippet(full_content, query)

                results.append(
                    {
                        "version_id": result_dict["version_id"],
                        "version_no": result_dict["version_no"],
                        "transcript_id": result_dict["transcript_id"],
                        "media_id": result_dict["media_id"],
                        "media_filename": result_dict["media_filename"],
                        "owner": owner_data,
                        "snippet": snippet,
                        "rank": result_dict["rank_score"],
                        "created_at": result_dict["created_at"],
                    }
                )

            return results
        finally:
            cursor.close()

    def _generate_snippet(self, content, query, snippet_length=64):
        """
        生成带高亮的摘要片段

        Args:
            content: 完整文本内容
            query: 搜索关键词
            snippet_length: 摘要片段长度（关键词前后各保留的字符数）

        Returns:
            str: 带 <mark> 标签高亮的摘要片段
        """
        if not content:
            return ""

        # 分词：支持空格分隔的多词搜索
        keywords = query.strip().split()

        # 查找第一个关键词的位置（不区分大小写）
        content_lower = content.lower()
        first_match_pos = -1
        matched_keyword = None

        for keyword in keywords:
            keyword_lower = keyword.lower()
            pos = content_lower.find(keyword_lower)
            if pos != -1 and (first_match_pos == -1 or pos < first_match_pos):
                first_match_pos = pos
                matched_keyword = keyword

        # 如果没有找到匹配，返回前面部分内容
        if first_match_pos == -1:
            return content[: snippet_length * 2] + (
                "..." if len(content) > snippet_length * 2 else ""
            )

        # 计算摘要起始和结束位置
        start = max(0, first_match_pos - snippet_length)
        end = min(len(content), first_match_pos + len(matched_keyword) + snippet_length)

        # 提取摘要
        snippet = content[start:end]

        # 添加省略号
        if start > 0:
            snippet = "..." + snippet
        if end < len(content):
            snippet = snippet + "..."

        # 高亮所有关键词（不区分大小写）
        for keyword in keywords:
            # 使用正则表达式进行不区分大小写的替换
            import re

            pattern = re.compile(re.escape(keyword), re.IGNORECASE)
            snippet = pattern.sub(f"**{keyword}**", snippet)

        return snippet


class TranscriptListView(generics.ListAPIView):
    """
    转录列表视图
    GET /api/transcripts/
    """
    
    serializer_class = TranscriptSerializer
    permission_classes = [permissions.IsAuthenticated, IsActiveUser]
    
    def get_queryset(self):
        queryset = Transcript.objects.select_related('media', 'owner', 'current_version').all()
        
        # 状态筛选
        status = self.request.query_params.get('status')
        if status and status != 'all':
            # 根据媒体文件的状态筛选
            queryset = queryset.filter(media__latest_status=status)
        
        # 搜索筛选
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                media__filename__icontains=search
            )
        
        return queryset.order_by('-updated_at')
    
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        
        # 为每个转录添加额外信息
        data = []
        for transcript in queryset:
            transcript_data = TranscriptSerializer(transcript).data
            
            # 添加前端需要的字段
            transcript_data.update({
                'id': transcript.id,
                'filename': transcript.media.filename,
                'status': 'completed' if transcript.current_version else 'processing',
                'language': 'zh-CN',  # 默认语言
                'duration': transcript.media.duration,
                'created_at': transcript.created_at,
                'content': transcript.current_version.content if transcript.current_version else '',
                'version': transcript.current_version.version_no if transcript.current_version else 1,
                'resource': {
                    'id': transcript.media.id,
                    'filename': transcript.media.filename
                } if transcript.media else None
            })
            data.append(transcript_data)
        
        return Response(data)


class TranscriptDetailView(generics.RetrieveUpdateAPIView):
    """
    转录详情视图
    GET /api/transcripts/{id}/
    PATCH /api/transcripts/{id}/
    """
    
    queryset = Transcript.objects.select_related('media', 'owner', 'current_version').all()
    serializer_class = TranscriptSerializer
    permission_classes = [permissions.IsAuthenticated, IsActiveUser]
    
    def update(self, request, *args, **kwargs):
        transcript = self.get_object()
        content = request.data.get('content')
        
        if content:
            # 创建新版本
            latest_version = transcript.versions.first()
            new_version_no = (latest_version.version_no + 1) if latest_version else 1
            
            new_version = TranscriptVersion.objects.create(
                transcript=transcript,
                editor=request.user,
                version_no=new_version_no,
                content=content
            )
            
            # 更新当前版本
            transcript.current_version = new_version
            transcript.char_count = len(content)
            transcript.summary = content[:200]
            transcript.save()
            
            # 记录审计日志
            ActivityLog.log(
                event="transcript_edited",
                actor=request.user,
                details={
                    "transcript_id": transcript.id,
                    "new_version": new_version_no,
                    "char_count": len(content)
                },
                request=request,
            )
        
        return Response({'ok': True, 'data': TranscriptSerializer(transcript).data})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsActiveUser])
def transcript_download(request, pk):
    """
    下载转录文本
    GET /api/transcripts/{id}/download/
    """
    try:
        transcript = Transcript.objects.select_related('media', 'current_version').get(pk=pk)
        
        if not transcript.current_version:
            return Response(
                {'error': 'No content available for download'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        content = transcript.current_version.content
        filename = f"{transcript.media.filename}.txt"
        
        response = HttpResponse(content, content_type='text/plain; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        # 记录审计日志
        ActivityLog.log(
            event="transcript_downloaded",
            actor=request.user,
            details={
                "transcript_id": transcript.id,
                "filename": filename
            },
            request=request,
        )
        
        return response
        
    except Transcript.DoesNotExist:
        return Response(
            {'error': 'Transcript not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
