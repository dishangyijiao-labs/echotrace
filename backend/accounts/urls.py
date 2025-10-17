"""
URL configuration for accounts app
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "accounts"

urlpatterns = [
    # Authentication
    path("auth/register/", views.SignupView.as_view(), name="register"),
    path("auth/signin/", views.SigninView.as_view(), name="signin"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path(
        "auth/change-password/",
        views.ChangePasswordView.as_view(),
        name="change_password",
    ),
    # User Management (Admin only)
    path("users/", views.UserListView.as_view(), name="user_list"),
    path("users/<int:pk>/", views.UserDetailView.as_view(), name="user_detail"),
    path(
        "users/<int:pk>/role/",
        views.UserRoleUpdateView.as_view(),
        name="user_role_update",
    ),
    path(
        "users/<int:pk>/status/",
        views.UserStatusUpdateView.as_view(),
        name="user_status_update",
    ),
    path(
        "users/<int:pk>/reset-password/",
        views.UserPasswordResetView.as_view(),
        name="user_password_reset",
    ),
]
