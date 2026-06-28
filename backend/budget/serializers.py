from rest_framework import serializers
from .models import BudgetScenario, BudgetLineItem


class BudgetLineItemSerializer(serializers.ModelSerializer):
    variance = serializers.SerializerMethodField()

    class Meta:
        model = BudgetLineItem
        fields = [
            "id", "scenario", "period", "department", "category",
            "budget_amount", "actual_amount", "variance", "notes",
        ]

    def get_variance(self, obj):
        return float(obj.budget_amount - obj.actual_amount)


class BudgetScenarioSerializer(serializers.ModelSerializer):
    line_items = BudgetLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetScenario
        fields = ["id", "name", "period_type", "description", "created_at", "updated_at", "line_items"]
