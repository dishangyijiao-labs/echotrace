from typing import ClassVar

from django.db.models import Q
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Schedule, ScheduleRun
from .serializers import (
    ScheduleCreateSerializer,
    ScheduleRunSerializer,
    ScheduleSerializer,
)


class ScheduleListCreateView(generics.ListCreateAPIView):
    """调度任务列表和创建视图"""

    permission_classes: ClassVar = [IsAuthenticated]

    def get_queryset(self):
        queryset = Schedule.objects.all()

        # 过滤参数
        status_filter = self.request.query_params.get("status")
        type_filter = self.request.query_params.get("type")
        search = self.request.query_params.get("search")

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if type_filter:
            queryset = queryset.filter(type=type_filter)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScheduleCreateSerializer
        return ScheduleSerializer


class ScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """调度任务详情视图"""

    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    permission_classes: ClassVar = [IsAuthenticated]


class ScheduleRunListView(generics.ListAPIView):
    """调度执行记录列表视图"""

    serializer_class = ScheduleRunSerializer
    permission_classes: ClassVar = [IsAuthenticated]

    def get_queryset(self):
        schedule_id = self.kwargs.get("schedule_id")
        queryset = ScheduleRun.objects.filter(schedule_id=schedule_id)

        # 过滤参数
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def schedule_run(request, pk):
    """手动执行调度任务"""
    try:
        schedule = Schedule.objects.get(pk=pk)
    except Schedule.DoesNotExist:
        return Response(
            {"error": "Schedule not found"}, status=status.HTTP_404_NOT_FOUND
        )

    # 检查调度是否处于活动状态
    if schedule.status != "active":
        return Response(
            {"error": "Schedule is not active"}, status=status.HTTP_400_BAD_REQUEST
        )

    # 创建执行记录
    schedule_run = ScheduleRun.objects.create(schedule=schedule, status="running")

    # 这里应该触发实际的任务执行逻辑
    # 目前只是模拟
    schedule_run.status = "completed"
    schedule_run.result = {"message": "Task executed successfully"}
    schedule_run.save()

    # 更新调度统计
    schedule.run_count += 1
    schedule.success_count += 1
    schedule.save()

    serializer = ScheduleRunSerializer(schedule_run)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def schedule_pause(request, pk):
    """暂停调度任务"""
    try:
        schedule = Schedule.objects.get(pk=pk)
    except Schedule.DoesNotExist:
        return Response(
            {"error": "Schedule not found"}, status=status.HTTP_404_NOT_FOUND
        )

    schedule.status = "paused"
    schedule.save()

    serializer = ScheduleSerializer(schedule)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def schedule_resume(request, pk):
    """恢复调度任务"""
    try:
        schedule = Schedule.objects.get(pk=pk)
    except Schedule.DoesNotExist:
        return Response(
            {"error": "Schedule not found"}, status=status.HTTP_404_NOT_FOUND
        )

    schedule.status = "active"
    schedule.save()

    serializer = ScheduleSerializer(schedule)
    return Response(serializer.data)
