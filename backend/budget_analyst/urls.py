from django.urls import path, include

urlpatterns = [
    path("api/", include("budget.urls")),
    path("api/", include("chat.urls")),
]
