from django.urls import path

from . import views

app_name = "scheduler"

urlpatterns = [
    # 调度任务
    path(
        "schedules/",
        views.ScheduleListCreateView.as_view(),
        name="schedule-list-create",
    ),
    path(
        "schedules",
        views.ScheduleListCreateView.as_view(),
        name="schedule-list-create-no-slash",
    ),
    path(
        "schedules/<int:pk>/",
        views.ScheduleDetailView.as_view(),
        name="schedule-detail",
    ),
    path(
        "schedules/<int:pk>",
        views.ScheduleDetailView.as_view(),
        name="schedule-detail-no-slash",
    ),
    # 调度执行记录
    path(
        "schedules/<int:schedule_id>/runs/",
        views.ScheduleRunListView.as_view(),
        name="schedule-run-list",
    ),
    path(
        "schedules/<int:schedule_id>/runs",
        views.ScheduleRunListView.as_view(),
        name="schedule-run-list-no-slash",
    ),
    # 调度操作
    path("schedules/<int:pk>/run/", views.schedule_run, name="schedule-run"),
    path("schedules/<int:pk>/run", views.schedule_run, name="schedule-run-no-slash"),
    path("schedules/<int:pk>/pause/", views.schedule_pause, name="schedule-pause"),
    path(
        "schedules/<int:pk>/pause", views.schedule_pause, name="schedule-pause-no-slash"
    ),
    path("schedules/<int:pk>/resume/", views.schedule_resume, name="schedule-resume"),
    path(
        "schedules/<int:pk>/resume",
        views.schedule_resume,
        name="schedule-resume-no-slash",
    ),
]
