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
        is_active = self.request.query_params.get("is_active")
        schedule_type = self.request.query_params.get("schedule_type")
        search = self.request.query_params.get("search")

        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == "true")

        if schedule_type:
            queryset = queryset.filter(schedule_type=schedule_type)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        return queryset.order_by("-created_at")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ScheduleCreateSerializer
        return ScheduleSerializer

    def list(self, request, *args, **kwargs):
        """Wrap list response"""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({"ok": True, "data": serializer.data})

    def create(self, request, *args, **kwargs):
        """Wrap create response"""
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            schedule = serializer.save()
            return Response(
                {"ok": True, "data": ScheduleSerializer(schedule).data},
                status=status.HTTP_201_CREATED,
            )
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


class ScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """调度任务详情视图"""

    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    permission_classes: ClassVar = [IsAuthenticated]

    def retrieve(self, request, *args, **kwargs):
        """Wrap retrieve response"""
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"ok": True, "data": serializer.data})

    def update(self, request, *args, **kwargs):
        """Wrap update response"""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(
            instance, data=request.data, partial=partial
        )
        if serializer.is_valid():
            schedule = serializer.save()
            result_data = ScheduleSerializer(schedule).data
            return Response({"ok": True, "data": result_data})
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "details": serializer.errors,
                },
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def destroy(self, request, *args, **kwargs):
        """Wrap destroy response"""
        instance = self.get_object()
        instance.delete()
        return Response(
            {"ok": True, "message": "Schedule deleted successfully"},
            status=status.HTTP_204_NO_CONTENT,
        )


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


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def schedule_toggle(request, pk):
    """切换调度任务状态(活跃/暂停)"""
    try:
        schedule = Schedule.objects.get(pk=pk)
    except Schedule.DoesNotExist:
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Schedule not found",
                },
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    # Toggle is_active status
    schedule.is_active = request.data.get("is_active", not schedule.is_active)
    schedule.save()

    serializer = ScheduleSerializer(schedule)
    return Response({"ok": True, "data": serializer.data})
