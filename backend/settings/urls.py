from django.urls import path

from .views import NASTestView, SettingsListView, SettingsUpdateView

urlpatterns = [
    path("", SettingsListView.as_view(), name="settings-list"),
    path("", SettingsListView.as_view(), name="settings-list"),
    path("update/", SettingsUpdateView.as_view(), name="settings-update"),
    path("test-nas/", NASTestView.as_view(), name="settings-test-nas"),
]
