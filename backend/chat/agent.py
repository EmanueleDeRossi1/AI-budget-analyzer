import json
from dataclasses import dataclass
from typing import Callable
from agents import Agent, function_tool, RunContextWrapper
from asgiref.sync import sync_to_async
from budget.models import BudgetLineItem


# ── Agent context ─────────────────────────────────────────────────────────────

@dataclass
class AgentContext:
    scenario_id: int
    emit: Callable[[str, dict], None]   # (event_type, payload)


# ── Tools ─────────────────────────────────────────────────────────────────────

@function_tool
async def get_budget_data(ctx: RunContextWrapper[AgentContext]) -> str:
    """
    Fetch all budget line items for the current scenario with pre-computed variances.
    Always call this before answering any budget question.
    """
    def _fetch():
        items = list(BudgetLineItem.objects.filter(scenario_id=ctx.context.scenario_id))
        result = []
        for item in items:
            variance = item.budget_amount - item.actual_amount
            pct = (variance / item.budget_amount * 100) if item.budget_amount else 0
            entry = {
                "period": item.period,
                "department": item.department,
                "category": item.category,
                "budget": float(item.budget_amount),
                "actual": float(item.actual_amount),
                "variance": float(variance),
                "variance_pct": round(float(pct), 1),
                "over_budget": variance < 0,
            }
            if item.notes:
                entry["notes"] = item.notes
            result.append(entry)
        return result

    return json.dumps(await sync_to_async(_fetch)())


@function_tool
def update_view(
    ctx: RunContextWrapper[AgentContext],
    departments: list[str] = [],
    categories: list[str] = [],
    periods: list[str] = [],
    group_by: list[str] = [],
    sort_by: str = "variance",
    sort_dir: str = "desc",
    highlight_departments: list[str] = [],
    highlight_categories: list[str] = [],
    highlight_periods: list[str] = [],
    columns: list[str] = [],
) -> str:
    """
    Update the budget table: filter, group, sort, highlight, and toggle computed columns.
    Use only exact values from get_budget_data.

    Filter (empty = show all):
      departments, categories, periods

    Layout:
      group_by: e.g. ["department"] or ["period", "category"]
               valid values: "period", "department", "category"
      sort_by: "variance" | "budget" | "actual"
      sort_dir: "desc" | "asc"

    Highlight (draw attention without hiding other rows):
      highlight_departments, highlight_categories, highlight_periods

    Computed columns (toggle derived columns in the table):
      columns: e.g. ["pctOfTotal", "burnRate"]
               valid values: "pctOfTotal", "burnRate", "variancePct", "runningTotal", "rank"
    """
    params: dict = {"sort_by": sort_by, "sort_dir": sort_dir}
    if departments:
        params["departments"] = departments
    if categories:
        params["categories"] = categories
    if periods:
        params["periods"] = periods
    valid_group = [g for g in group_by if g in ("period", "department", "category")]
    if valid_group:
        params["group_by"] = valid_group
    if columns:
        valid_cols = [c for c in columns if c in ("pctOfTotal", "burnRate", "variancePct", "runningTotal", "rank")]
        if valid_cols:
            params["columns"] = valid_cols
    if highlight_departments:
        params["highlight_departments"] = highlight_departments
    if highlight_categories:
        params["highlight_categories"] = highlight_categories
    if highlight_periods:
        params["highlight_periods"] = highlight_periods

    ctx.context.emit("operation", {"id": "updateView", "params": params})

    return "View updated."


@function_tool
def reset_view(ctx: RunContextWrapper[AgentContext]) -> str:
    """
    Clear all filters, groupings, highlights, and computed columns,
    returning the table to its default flat view.
    """
    ctx.context.emit("operation", {"id": "resetView", "params": {}})
    return "View reset."


# ── Agent ─────────────────────────────────────────────────────────────────────

agent = Agent(
    name="Budget Analyst",
    model="o4-mini",
    instructions=(
        "You are a finance analyst.\n\n"
        "Workflow: always get_budget_data first, then update_view to show the answer.\n\n"
        "Variance = Budget − Actual. Positive = favorable, negative = unfavorable.\n\n"
        "Use only exact values from the data. Do your own arithmetic carefully "
        "using the pre-computed fields (variance, variance_pct) where possible.\n\n"
        "update_view: highlight the rows that answer the question. "
        "Only group_by when the user is comparing across a dimension (e.g. 'by department'). "
        "Don't group for single-row lookups.\n\n"
        "When showing percentages or comparisons, toggle the appropriate computed columns "
        "(pctOfTotal, burnRate, variancePct, rank) so the user can see them in the table.\n\n"
        "Reply in 1-2 sentences. Don't repeat what the table shows."
    ),
    tools=[get_budget_data, update_view, reset_view],
)
