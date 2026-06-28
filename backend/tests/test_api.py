"""
REST API tests — CRUD and the scenario-scoped line items filter.
"""
import pytest
from django.test import TestCase
from rest_framework.test import APIClient

from budget.models import BudgetScenario, BudgetLineItem


@pytest.mark.django_db
class TestBudgetScenarioAPI:
    def setup_method(self):
        self.client = APIClient()

    def test_create_scenario(self):
        res = self.client.post("/api/scenarios/", {
            "name": "FY2026", "period_type": "quarter", "description": ""
        }, format="json")
        assert res.status_code == 201
        assert res.data["name"] == "FY2026"
        assert res.data["period_type"] == "quarter"

    def test_list_scenarios(self):
        BudgetScenario.objects.create(name="A", period_type="quarter")
        BudgetScenario.objects.create(name="B", period_type="month")
        res = self.client.get("/api/scenarios/")
        assert res.status_code == 200
        assert len(res.data) == 2

    def test_get_scenario_includes_line_items(self):
        s = BudgetScenario.objects.create(name="S", period_type="quarter")
        BudgetLineItem.objects.create(
            scenario=s, period="Q1", department="Eng", category="Tools",
            budget_amount=100, actual_amount=80
        )
        res = self.client.get(f"/api/scenarios/{s.id}/")
        assert res.status_code == 200
        assert len(res.data["line_items"]) == 1

    def test_delete_scenario_cascades_line_items(self):
        s = BudgetScenario.objects.create(name="S", period_type="quarter")
        BudgetLineItem.objects.create(
            scenario=s, period="Q1", department="Eng", category="Tools",
            budget_amount=100, actual_amount=80
        )
        self.client.delete(f"/api/scenarios/{s.id}/")
        assert BudgetLineItem.objects.count() == 0

    def test_reject_invalid_period_type(self):
        res = self.client.post("/api/scenarios/", {
            "name": "Bad", "period_type": "custom"
        }, format="json")
        assert res.status_code == 400


@pytest.mark.django_db
class TestLineItemScenarioFilter:
    def setup_method(self):
        self.client = APIClient()
        self.s1 = BudgetScenario.objects.create(name="S1", period_type="quarter")
        self.s2 = BudgetScenario.objects.create(name="S2", period_type="quarter")
        BudgetLineItem.objects.create(
            scenario=self.s1, period="Q1", department="Eng", category="Tools",
            budget_amount=100, actual_amount=80
        )
        BudgetLineItem.objects.create(
            scenario=self.s1, period="Q2", department="Sales", category="Travel",
            budget_amount=200, actual_amount=220
        )
        BudgetLineItem.objects.create(
            scenario=self.s2, period="Q1", department="HR", category="Recruiting",
            budget_amount=50, actual_amount=45
        )

    def test_filter_returns_only_requested_scenario(self):
        res = self.client.get(f"/api/line-items/?scenario={self.s1.id}")
        assert res.status_code == 200
        assert len(res.data) == 2
        ids = {item["scenario"] for item in res.data}
        assert ids == {self.s1.id}

    def test_no_filter_returns_all(self):
        res = self.client.get("/api/line-items/")
        assert res.status_code == 200
        assert len(res.data) == 3

    def test_patch_updates_amount(self):
        item = BudgetLineItem.objects.filter(scenario=self.s1).first()
        res = self.client.patch(
            f"/api/line-items/{item.id}/", {"actual_amount": "999.00"}, format="json"
        )
        assert res.status_code == 200
        item.refresh_from_db()
        assert float(item.actual_amount) == 999.0
