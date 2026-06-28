"""
Tests for _tool_call_to_operation — the function that translates agent
tool calls into SSE operation events consumed by the frontend.

A wrong key name here silently breaks the UI with no error, so this is
worth pinning precisely.
"""
import json
import pytest

from chat.utils import tool_call_to_operation as _tool_call_to_operation


def args(**kwargs):
    return json.dumps(kwargs)


class TestResetDisplay:
    def test_returns_reset_operation(self):
        op = _tool_call_to_operation("reset_display", "{}")
        assert op == {"type": "operation", "id": "resetView", "params": {}}

    def test_params_is_empty(self):
        op = _tool_call_to_operation("reset_display", "{}")
        assert op["params"] == {}


class TestDisplayBudget:
    def test_basic_structure(self):
        op = _tool_call_to_operation("display_budget", args())
        assert op["type"] == "operation"
        assert op["id"] == "updateView"
        assert "params" in op

    def test_defaults_sort_by_variance_desc(self):
        params = _tool_call_to_operation("display_budget", args())["params"]
        assert params["sort_by"] == "variance"
        assert params["sort_dir"] == "desc"

    def test_explicit_sort_fields(self):
        params = _tool_call_to_operation(
            "display_budget", args(sort_by="actual", sort_dir="asc")
        )["params"]
        assert params["sort_by"] == "actual"
        assert params["sort_dir"] == "asc"

    def test_period_filter_mapped_to_periods(self):
        params = _tool_call_to_operation(
            "display_budget", args(filters={"period": ["Q1", "Q2"]})
        )["params"]
        assert params["periods"] == ["Q1", "Q2"]
        # other filter keys should not appear
        assert "departments" not in params
        assert "categories" not in params

    def test_department_filter_mapped_to_departments(self):
        params = _tool_call_to_operation(
            "display_budget", args(filters={"department": ["Engineering"]})
        )["params"]
        assert params["departments"] == ["Engineering"]

    def test_category_filter_mapped_to_categories(self):
        params = _tool_call_to_operation(
            "display_budget", args(filters={"category": ["Travel", "Tools"]})
        )["params"]
        assert params["categories"] == ["Travel", "Tools"]

    def test_all_filters_together(self):
        params = _tool_call_to_operation(
            "display_budget",
            args(filters={"period": ["Q1"], "department": ["Sales"], "category": ["Travel"]}),
        )["params"]
        assert params["periods"] == ["Q1"]
        assert params["departments"] == ["Sales"]
        assert params["categories"] == ["Travel"]

    def test_empty_filters_omitted(self):
        params = _tool_call_to_operation(
            "display_budget", args(filters={"period": [], "department": []})
        )["params"]
        assert "periods" not in params
        assert "departments" not in params

    def test_group_by_passed_through(self):
        params = _tool_call_to_operation(
            "display_budget", args(group_by=["department", "category"])
        )["params"]
        assert params["group_by"] == ["department", "category"]

    def test_columns_passed_through(self):
        params = _tool_call_to_operation(
            "display_budget", args(columns=["burnRate", "variancePct"])
        )["params"]
        assert params["columns"] == ["burnRate", "variancePct"]

    def test_empty_group_by_omitted(self):
        params = _tool_call_to_operation(
            "display_budget", args(group_by=[])
        )["params"]
        assert "group_by" not in params


class TestUnknownTool:
    def test_returns_none(self):
        assert _tool_call_to_operation("query_budget", "{}") is None

    def test_unknown_name_returns_none(self):
        assert _tool_call_to_operation("nonexistent_tool", "{}") is None
