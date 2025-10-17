from django.urls import path

from . import views

app_name = "activities"

urlpatterns = [
    # 活动日志
    path(
        "activities/",
        views.ActivityListCreateView.as_view(),
        name="activity-list-create",
    ),
    path(
        "activities",
        views.ActivityListCreateView.as_view(),
        name="activity-list-create-no-slash",
    ),
    path(
        "activities/<int:pk>/",
        views.ActivityDetailView.as_view(),
        name="activity-detail",
    ),
    path(
        "activities/<int:pk>",
        views.ActivityDetailView.as_view(),
        name="activity-detail-no-slash",
    ),
    # 活动统计
    path("activities/stats/", views.activity_stats, name="activity-stats"),
    path("activities/stats", views.activity_stats, name="activity-stats-no-slash"),
    path(
        "activities/user-stats/", views.user_activity_stats, name="user-activity-stats"
    ),
    path(
        "activities/user-stats",
        views.user_activity_stats,
        name="user-activity-stats-no-slash",
    ),
    path("activities/trends/", views.activity_trends, name="activity-trends"),
    path("activities/trends", views.activity_trends, name="activity-trends-no-slash"),
]
