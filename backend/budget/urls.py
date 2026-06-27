from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BudgetScenarioViewSet, BudgetLineItemViewSet

router = DefaultRouter()
router.register("scenarios", BudgetScenarioViewSet)
router.register("line-items", BudgetLineItemViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
