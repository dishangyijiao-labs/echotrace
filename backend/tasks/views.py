from typing import ClassVar

from django.db.models import Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsActiveUser

from .models import Task
from .serializers import TaskCreateSerializer, TaskSerializer, TaskUpdateSerializer


class TaskListCreateView(generics.ListCreateAPIView):
    """任务列表和创建视图"""
    permission_classes: ClassVar = [permissions.IsAuthenticated, IsActiveUser]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TaskCreateSerializer
        return TaskSerializer

    def get_queryset(self):
        queryset = Task.objects.all()

        # 过滤参数
        status_filter = self.request.query_params.get("status")
        type_filter = self.request.query_params.get("type")
        priority_filter = self.request.query_params.get("priority")
        assigned_to = self.request.query_params.get("assigned_to")
        search = self.request.query_params.get("search")

        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if type_filter:
            queryset = queryset.filter(type=type_filter)

        if priority_filter:
            queryset = queryset.filter(priority=priority_filter)

        if assigned_to:
            if assigned_to == "me":
                queryset = queryset.filter(assigned_to=self.request.user)
            else:
                queryset = queryset.filter(assigned_to_id=assigned_to)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response({"ok": True, "data": serializer.data})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save()
            return Response(
                {"ok": True, "data": TaskSerializer(task).data},
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


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    """任务详情视图"""

    queryset = Task.objects.all()
    permission_classes: ClassVar = [permissions.IsAuthenticated, IsActiveUser]

    def get_serializer_class(self):
        if self.request.method in ["PUT", "PATCH"]:
            return TaskUpdateSerializer
        return TaskSerializer

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"ok": True, "data": serializer.data})

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)

        if serializer.is_valid():
            task = serializer.save()
            return Response({"ok": True, "data": TaskSerializer(task).data})

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
        instance = self.get_object()
        instance.delete()
        return Response(
            {"ok": True, "message": "Task deleted successfully"},
            status=status.HTTP_204_NO_CONTENT,
        )


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated, IsActiveUser])
def update_task_priority(request, task_id):
    """更新任务优先级"""
    try:
        task = Task.objects.get(id=task_id)
    except Task.DoesNotExist:
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "TASK_NOT_FOUND",
                    "message": "Task not found"
                }
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    new_priority = request.data.get('priority')
    if not new_priority:
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "MISSING_PRIORITY",
                    "message": "Priority is required"
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 验证优先级值是否有效
    valid_priorities = [choice[0] for choice in Task.PRIORITY_CHOICES]
    if new_priority not in valid_priorities:
        return Response(
            {
                "ok": False,
                "error": {
                    "code": "INVALID_PRIORITY",
                    "message": f"Priority must be one of: {', '.join(valid_priorities)}"
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # 更新优先级
    old_priority = task.priority
    task.priority = new_priority
    task.save(update_fields=['priority', 'updated_at'])
    
    return Response({
        "ok": True,
        "data": {
            "id": task.id,
            "name": task.name,
            "old_priority": old_priority,
            "new_priority": new_priority,
            "priority_display": task.get_priority_display()
        },
        "message": f"Task priority updated from {old_priority} to {new_priority}"
    })
