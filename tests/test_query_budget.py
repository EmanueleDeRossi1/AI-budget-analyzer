"""
Tests for the query_budget tool logic — variance math, grouping, filtering,
and threshold filtering (min/max_variance_pct).

These run against a real in-memory SQLite DB (Django's test runner swaps
Postgres for SQLite automatically), so no mocking is needed.
"""
import json
import pytest
from asgiref.sync import async_to_sync

from budget.models import BudgetScenario, BudgetLineItem
from chat.agent import query_budget, AgentContext, DimensionFilter
from agents import RunContextWrapper


# ── helpers ───────────────────────────────────────────────────────────────────

def make_scenario(**kwargs):
    return BudgetScenario.objects.create(
        name="Test", period_type="quarter", **kwargs
    )


def make_item(scenario, *, budget, actual, department="Eng", category="Tools", period="Q1"):
    return BudgetLineItem.objects.create(
        scenario=scenario,
        budget_amount=budget,
        actual_amount=actual,
        department=department,
        category=category,
        period=period,
    )


def run_query(scenario_id, filters=None, group_by=None, min_variance_pct=None, max_variance_pct=None):
    """Synchronous wrapper around the async query_budget tool."""
    ctx = RunContextWrapper(context=AgentContext(scenario_id=scenario_id))
    result = async_to_sync(query_budget.on_invoke_tool)(
        ctx,
        json.dumps({
            "filters": (filters or {}).model_dump() if hasattr(filters, "model_dump") else (filters or {}),
            "group_by": group_by or [],
            **({"min_variance_pct": min_variance_pct} if min_variance_pct is not None else {}),
            **({"max_variance_pct": max_variance_pct} if max_variance_pct is not None else {}),
        }),
    )
    return json.loads(result)


# ── variance math ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestVarianceMath:
    def test_under_budget_positive_variance(self):
        s = make_scenario()
        make_item(s, budget=100, actual=80)   # spent less → favorable
        rows = run_query(s.id)
        assert rows[0]["variance"] == 20.0
        assert rows[0]["variance_pct"] == 20.0
        assert rows[0]["over_budget"] is False

    def test_over_budget_negative_variance(self):
        s = make_scenario()
        make_item(s, budget=100, actual=120)  # overspent → unfavorable
        rows = run_query(s.id)
        assert rows[0]["variance"] == -20.0
        assert rows[0]["variance_pct"] == -20.0
        assert rows[0]["over_budget"] is True

    def test_on_budget_zero_variance(self):
        s = make_scenario()
        make_item(s, budget=100, actual=100)
        rows = run_query(s.id)
        assert rows[0]["variance"] == 0.0
        assert rows[0]["variance_pct"] == 0.0
        assert rows[0]["over_budget"] is False

    def test_zero_budget_no_divide_by_zero(self):
        s = make_scenario()
        make_item(s, budget=0, actual=50)
        rows = run_query(s.id)
        assert rows[0]["variance_pct"] == 0.0
        assert rows[0]["burn_rate"] == 0.0

    def test_burn_rate(self):
        s = make_scenario()
        make_item(s, budget=200, actual=150)
        rows = run_query(s.id)
        assert rows[0]["burn_rate"] == 75.0   # 150/200 * 100

    def test_pct_of_total_single_item(self):
        s = make_scenario()
        make_item(s, budget=100, actual=60)
        rows = run_query(s.id)
        assert rows[0]["pct_of_total"] == 100.0

    def test_pct_of_total_multiple_items(self):
        s = make_scenario()
        make_item(s, budget=100, actual=40, department="A")
        make_item(s, budget=100, actual=60, department="B")
        rows = run_query(s.id)
        by_dept = {r["department"]: r for r in rows}
        assert by_dept["A"]["pct_of_total"] == 40.0   # 40/100
        assert by_dept["B"]["pct_of_total"] == 60.0   # 60/100


# ── dimension filtering ───────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDimensionFiltering:
    def test_filter_by_department(self):
        s = make_scenario()
        make_item(s, budget=100, actual=80, department="Eng")
        make_item(s, budget=100, actual=90, department="Sales")
        rows = run_query(s.id, filters={"department": ["Eng"]})
        assert len(rows) == 1
        assert rows[0]["department"] == "Eng"

    def test_filter_by_period(self):
        s = make_scenario()
        make_item(s, budget=100, actual=50, period="Q1")
        make_item(s, budget=100, actual=70, period="Q2")
        rows = run_query(s.id, filters={"period": ["Q1"]})
        assert len(rows) == 1
        assert rows[0]["period"] == "Q1"

    def test_filter_by_category(self):
        s = make_scenario()
        make_item(s, budget=100, actual=50, category="Travel")
        make_item(s, budget=100, actual=70, category="Tools")
        rows = run_query(s.id, filters={"category": ["Travel"]})
        assert len(rows) == 1
        assert rows[0]["category"] == "Travel"

    def test_empty_filter_returns_all(self):
        s = make_scenario()
        make_item(s, budget=100, actual=50, department="Eng")
        make_item(s, budget=100, actual=70, department="Sales")
        rows = run_query(s.id, filters={})
        assert len(rows) == 2

    def test_scenario_isolation(self):
        """Items from a different scenario must not appear."""
        s1 = make_scenario()
        s2 = make_scenario()
        make_item(s1, budget=100, actual=80)
        make_item(s2, budget=200, actual=150)
        rows = run_query(s1.id)
        assert len(rows) == 1
        assert rows[0]["budget"] == 100.0


# ── variance threshold filtering ─────────────────────────────────────────────

@pytest.mark.django_db
class TestVarianceThreshold:
    def setup_method(self):
        self.s = make_scenario()
        # +50% under budget (favorable)
        make_item(self.s, budget=100, actual=50, department="A")
        # +10% under budget
        make_item(self.s, budget=100, actual=90, department="B")
        # -20% over budget (unfavorable)
        make_item(self.s, budget=100, actual=120, department="C")

    def test_min_variance_pct_filters_out_low(self):
        rows = run_query(self.s.id, min_variance_pct=20)
        depts = {r["department"] for r in rows}
        assert depts == {"A"}    # only 50% under-budget row passes

    def test_max_variance_pct_filters_over_budget(self):
        rows = run_query(self.s.id, max_variance_pct=-10)
        depts = {r["department"] for r in rows}
        assert depts == {"C"}    # only -20% row passes

    def test_combined_min_max_range(self):
        # 5–15% under budget → only B
        rows = run_query(self.s.id, min_variance_pct=5, max_variance_pct=15)
        depts = {r["department"] for r in rows}
        assert depts == {"B"}


# ── grouping ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestGroupBy:
    def test_group_by_department_aggregates_correctly(self):
        s = make_scenario()
        make_item(s, budget=100, actual=80, department="Eng", category="Tools")
        make_item(s, budget=200, actual=150, department="Eng", category="Travel")
        rows = run_query(s.id, group_by=["department"])
        assert len(rows) == 1
        row = rows[0]
        assert row["department"] == "Eng"
        assert row["budget"] == 300.0
        assert row["actual"] == 230.0
        assert row["variance"] == 70.0

    def test_group_by_invalid_dimension_ignored(self):
        """Invalid group_by values should be silently ignored, not crash."""
        s = make_scenario()
        make_item(s, budget=100, actual=80)
        rows = run_query(s.id, group_by=["nonexistent_field"])
        # Falls back to flat rows
        assert len(rows) == 1

    def test_group_by_period_sums_correctly(self):
        s = make_scenario()
        make_item(s, budget=100, actual=80, period="Q1", department="Eng")
        make_item(s, budget=200, actual=190, period="Q1", department="Sales")
        make_item(s, budget=150, actual=100, period="Q2", department="Eng")
        rows = run_query(s.id, group_by=["period"])
        by_period = {r["period"]: r for r in rows}
        assert by_period["Q1"]["actual"] == 270.0
        assert by_period["Q2"]["actual"] == 100.0
