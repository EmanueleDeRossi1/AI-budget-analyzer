from rest_framework import serializers
from .models import BudgetScenario, BudgetLineItem


class BudgetLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetLineItem
        fields = [
            "id", "scenario", "period", "department", "category",
            "budget_amount", "actual_amount", "notes",
        ]


class BudgetScenarioSerializer(serializers.ModelSerializer):
    line_items = BudgetLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetScenario
        fields = ["id", "name", "period_type", "description", "created_at", "updated_at", "line_items"]
