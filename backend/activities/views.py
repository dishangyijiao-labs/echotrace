from datetime import datetime, timedelta
from typing import ClassVar

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Activity
from .serializers import (
    ActivityCreateSerializer,
    ActivitySerializer,
    ActivityTrendSerializer,
    UserActivityStatsSerializer,
)


class ActivityListCreateView(generics.ListCreateAPIView):
    """活动日志列表和创建视图"""

    permission_classes: ClassVar = [IsAuthenticated]

    def get_queryset(self):
        queryset = Activity.objects.select_related("user").all()

        # 过滤参数
        user_id = self.request.query_params.get("user")
        action = self.request.query_params.get("action")
        level = self.request.query_params.get("level")
        search = self.request.query_params.get("search")
        start_date = self.request.query_params.get("start_date")
        end_date = self.request.query_params.get("end_date")

        if user_id:
            queryset = queryset.filter(user_id=user_id)

        if action:
            queryset = queryset.filter(action=action)

        if level:
            queryset = queryset.filter(level=level)

        if search:
            queryset = queryset.filter(
                Q(description__icontains=search) | Q(user__username__icontains=search)
            )

        if start_date:
            try:
                start_date = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
                queryset = queryset.filter(timestamp__gte=start_date)
            except ValueError:
                pass

        if end_date:
            try:
                end_date = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                queryset = queryset.filter(timestamp__lte=end_date)
            except ValueError:
                pass

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ActivityCreateSerializer
        return ActivitySerializer


class ActivityDetailView(generics.RetrieveAPIView):
    """活动日志详情视图"""

    queryset = Activity.objects.select_related("user").all()
    serializer_class = ActivitySerializer
    permission_classes: ClassVar = [IsAuthenticated]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_stats(request):
    """获取活动统计信息"""

    # 时间范围
    days = int(request.query_params.get("days", 30))
    start_date = timezone.now() - timedelta(days=days)

    # 基本统计
    total_activities = Activity.objects.filter(timestamp__gte=start_date).count()

    # 按动作统计
    action_stats = (
        Activity.objects.filter(timestamp__gte=start_date)
        .values("action")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    # 按级别统计
    level_stats = (
        Activity.objects.filter(timestamp__gte=start_date)
        .values("level")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    # 按用户统计
    user_stats = (
        Activity.objects.filter(timestamp__gte=start_date)
        .values("user__username")
        .annotate(count=Count("id"))
        .order_by("-count")[:10]
    )

    # 每日趋势
    daily_stats = []
    for i in range(days):
        date = (timezone.now() - timedelta(days=i)).date()
        day_activities = (
            Activity.objects.filter(timestamp__date=date)
            .values("action")
            .annotate(count=Count("id"))
        )

        day_data = {
            "date": date,
            "total_count": sum(item["count"] for item in day_activities),
        }

        # 按动作分组
        for item in day_activities:
            day_data[f"{item['action']}_count"] = item["count"]

        daily_stats.append(day_data)

    return Response(
        {
            "total_activities": total_activities,
            "action_stats": action_stats,
            "level_stats": level_stats,
            "user_stats": user_stats,
            "daily_trends": daily_stats,
            "period": f"{days} days",
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_activity_stats(request):
    """获取用户活动统计"""

    days = int(request.query_params.get("days", 30))
    start_date = timezone.now() - timedelta(days=days)

    # 用户活动统计
    user_stats = []

    # 获取活跃用户
    active_users = (
        Activity.objects.filter(timestamp__gte=start_date)
        .values("user_id", "user__username")
        .annotate(total_activities=Count("id"))
        .order_by("-total_activities")
    )

    for user_data in active_users:
        user_id = user_data["user_id"]

        # 最近活动
        recent_activities = Activity.objects.filter(
            user_id=user_id, timestamp__gte=timezone.now() - timedelta(days=7)
        ).count()

        # 最后活动时间
        last_activity = (
            Activity.objects.filter(user_id=user_id).order_by("-timestamp").first()
        )

        # 最常见动作
        most_common = (
            Activity.objects.filter(user_id=user_id, timestamp__gte=start_date)
            .values("action")
            .annotate(count=Count("id"))
            .order_by("-count")
            .first()
        )

        # 错误率
        error_count = Activity.objects.filter(
            user_id=user_id, timestamp__gte=start_date, level="error"
        ).count()

        error_rate = (
            (error_count / user_data["total_activities"]) * 100
            if user_data["total_activities"] > 0
            else 0
        )

        user_stats.append(
            {
                "user_id": user_id,
                "username": user_data["user__username"],
                "total_activities": user_data["total_activities"],
                "recent_activities": recent_activities,
                "last_activity": last_activity.timestamp if last_activity else None,
                "most_common_action": most_common["action"] if most_common else None,
                "error_rate": round(error_rate, 2),
            }
        )

    serializer = UserActivityStatsSerializer(user_stats, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def activity_trends(request):
    """获取活动趋势数据"""

    days = int(request.query_params.get("days", 30))

    trends = []
    for i in range(days):
        date = (timezone.now() - timedelta(days=i)).date()

        # 获取当天的活动统计
        day_activities = Activity.objects.filter(timestamp__date=date)

        trend_data = {
            "date": date,
            "total_count": day_activities.count(),
            "create_count": day_activities.filter(action="create").count(),
            "update_count": day_activities.filter(action="update").count(),
            "delete_count": day_activities.filter(action="delete").count(),
            "upload_count": day_activities.filter(action="upload").count(),
            "download_count": day_activities.filter(action="download").count(),
            "transcribe_count": day_activities.filter(action="transcribe").count(),
            "error_count": day_activities.filter(level="error").count(),
        }

        trends.append(trend_data)

    # 按日期排序
    trends.sort(key=lambda x: x["date"])

    serializer = ActivityTrendSerializer(trends, many=True)
    return Response(serializer.data)
