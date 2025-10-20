"""
Dashboard views - 仪表盘统计数据
"""
from datetime import timedelta

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from activities.models import Activity
from media.models import Job, MediaFile
from transcripts.models import Transcript


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    获取仪表盘统计数据
    GET /api/dashboard/stats/
    """
    # 总资源数 - MediaFile 模型
    total_resources = MediaFile.objects.count()

    # 转录文档数 - Transcript 模型
    total_transcripts = Transcript.objects.count()

    # 待处理任务 - Job with status=pending
    pending_tasks = Job.objects.filter(status="pending").count()

    # 已完成任务 - Job with status=succeeded
    completed_tasks = Job.objects.filter(status="succeeded").count()

    # 活跃用户数 - 最近7天有活动的用户
    seven_days_ago = timezone.now() - timedelta(days=7)
    active_users = (
        Activity.objects.filter(timestamp__gte=seven_days_ago)
        .values("user")
        .distinct()
        .count()
    )

    # 最近活动 - 最近10条活动记录
    recent_activities = Activity.objects.select_related("user").order_by(
        "-timestamp"
    )[:10]

    activity_list = []
    for activity in recent_activities:
        # 构建活动描述
        user_display = activity.user.username if activity.user else "系统"
        action_map = {
            "signup": "注册了账号",
            "signin": "登录系统",
            "logout": "退出登录",
            "upload": "上传了文件",
            "transcribe": "创建了转录任务",
            "edit_transcript": "编辑了转录文本",
            "delete": "删除了资源",
            "download": "下载了文件",
        }

        action_text = action_map.get(activity.action, activity.action)
        description = f"{user_display} {action_text}"

        # 格式化时间
        time_diff = timezone.now() - activity.timestamp
        if time_diff.total_seconds() < 60:
            time_str = "刚刚"
        elif time_diff.total_seconds() < 3600:
            minutes = int(time_diff.total_seconds() / 60)
            time_str = f"{minutes}分钟前"
        elif time_diff.total_seconds() < 86400:
            hours = int(time_diff.total_seconds() / 3600)
            time_str = f"{hours}小时前"
        else:
            days = int(time_diff.total_seconds() / 86400)
            time_str = f"{days}天前"

        activity_list.append(
            {"description": description, "timestamp": time_str}
        )

    return Response(
        {
            "ok": True,
            "data": {
                "totalResources": total_resources,
                "totalTranscripts": total_transcripts,
                "pendingTasks": pending_tasks,
                "completedTasks": completed_tasks,
                "activeUsers": active_users,
                "recentActivity": activity_list,
            },
        }
    )
