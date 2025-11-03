from django.urls import path

from .views import TaskDetailView, TaskListCreateView, update_task_priority

urlpatterns = [
    path("tasks/", TaskListCreateView.as_view(), name="task-list-create"),
    path("tasks/<int:pk>/", TaskDetailView.as_view(), name="task-detail"),
    path("tasks/<int:task_id>/priority/", update_task_priority, name="task-update-priority"),
]
