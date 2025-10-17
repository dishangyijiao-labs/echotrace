from django.urls import path

from .views import TranscriptSearchView, TranscriptListView, TranscriptDetailView, transcript_download

urlpatterns = [
    path("", TranscriptListView.as_view(), name="transcript-list"),
    path("<int:pk>/", TranscriptDetailView.as_view(), name="transcript-detail"),
    path("<int:pk>/download/", transcript_download, name="transcript-download"),
    # 搜索
    path(
        "search/transcripts", TranscriptSearchView.as_view(), name="transcript-search"
    ),
]
