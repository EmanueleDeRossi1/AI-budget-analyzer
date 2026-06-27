from rest_framework.viewsets import ModelViewSet
from .models import BudgetScenario, BudgetLineItem
from .serializers import BudgetScenarioSerializer, BudgetLineItemSerializer


class BudgetScenarioViewSet(ModelViewSet):
    queryset = BudgetScenario.objects.all()
    serializer_class = BudgetScenarioSerializer


class BudgetLineItemViewSet(ModelViewSet):
    queryset = BudgetLineItem.objects.all()
    serializer_class = BudgetLineItemSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        scenario_id = self.request.query_params.get("scenario")
        if scenario_id:
            qs = qs.filter(scenario_id=scenario_id)
        return qs
