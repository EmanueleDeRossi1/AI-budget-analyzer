import json
from dataclasses import dataclass
from typing import Callable
from agents import Agent, function_tool, RunContextWrapper
from asgiref.sync import sync_to_async
from budget.models import BudgetLineItem
from pydantic import BaseModel


class DimensionFilter(BaseModel):
    period: list[str] = []
    department: list[str] = []
    category: list[str] = []


# ── Agent context ─────────────────────────────────────────────────────────────

@dataclass
class AgentContext:
    scenario_id: int
    emit: Callable[[str, dict], None]   # (op_id, params)


# ── Tools ─────────────────────────────────────────────────────────────────────

@function_tool
async def query_budget(
    ctx: RunContextWrapper[AgentContext],
    filters: DimensionFilter = DimensionFilter(),
    group_by: list[str] = [],
) -> str:
    """
    Fetch budget line items for the current scenario with pre-computed variances.
    Always call this before answering any budget question.

    filters: narrow results by dimension.
             fields: period, department, category (each a list of values to include)

    group_by: aggregate by dimension(s), e.g. ["department"] or ["period", "category"]
              valid values: "period", "department", "category"
              omit for raw rows.
    """
    def _fetch():
        qs = BudgetLineItem.objects.filter(scenario_id=ctx.context.scenario_id)

        for dim, values in filters.model_dump().items():
            if values:
                qs = qs.filter(**{f"{dim}__in": values})

        valid_group = [g for g in group_by if g in DimensionFilter.model_fields]

        if valid_group:
            from django.db.models import Sum
            rows = qs.values(*valid_group).annotate(
                budget_amount=Sum("budget_amount"),
                actual_amount=Sum("actual_amount"),
            )
            result = []
            for row in rows:
                variance = row["budget_amount"] - row["actual_amount"]
                pct = (variance / row["budget_amount"] * 100) if row["budget_amount"] else 0
                result.append({
                    **{k: row[k] for k in valid_group},
                    "budget": float(row["budget_amount"]),
                    "actual": float(row["actual_amount"]),
                    "variance": float(variance),
                    "variance_pct": round(float(pct), 1),
                    "over_budget": variance < 0,
                })
        else:
            result = []
            for item in list(qs):
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
def display_budget(
    ctx: RunContextWrapper[AgentContext],
    filters: DimensionFilter = DimensionFilter(),
    group_by: list[str] = [],
    sort_by: str = "variance",
    sort_dir: str = "desc",
    columns: list[str] = [],
) -> str:
    """
    Update the budget table: filter, group, sort, and toggle computed columns.
    Use only exact values from query_budget.

    filters: hide non-matching rows.
             fields: period, department, category (each a list of values to include)

    group_by: e.g. ["department"] or ["period", "category"]
              valid values: "period", "department", "category"
              only use when comparing across a dimension, not for single-row lookups.

    sort_by: "variance" | "budget" | "actual"
    sort_dir: "desc" | "asc"

    columns: toggle computed columns, e.g. ["pctOfTotal", "burnRate"]
             valid values: "pctOfTotal", "burnRate", "variancePct", "runningTotal", "rank"
    """
    params: dict = {"sort_by": sort_by, "sort_dir": sort_dir}
    if filters.period:
        params["periods"] = filters.period
    if filters.department:
        params["departments"] = filters.department
    if filters.category:
        params["categories"] = filters.category
    if group_by:
        params["group_by"] = group_by
    if columns:
        params["columns"] = columns
    ctx.context.emit("updateView", params)
    return "View updated."


@function_tool
def reset_display(ctx: RunContextWrapper[AgentContext]) -> str:
    """
    Clear all filters, groupings, and computed columns,
    returning the table to its default flat view.
    """
    ctx.context.emit("resetView", {})
    return "View reset."


# ── Agent ─────────────────────────────────────────────────────────────────────

agent = Agent(
    name="Budget Analyst",
    model="o4-mini",
    instructions=(
        "You are a finance analyst.\n\n"
        "Workflow: always query_budget first, then display_budget to show the answer.\n\n"
        "Variance = Budget − Actual. Positive = favorable, negative = unfavorable.\n\n"
        "Use only exact values from the data. Do your own arithmetic carefully "
        "using the pre-computed fields (variance, variance_pct) where possible.\n\n"
        "display_budget: filter to the rows that answer the question. "
        "Only group_by when the user is comparing across a dimension (e.g. 'by department'). "
        "Don't group for single-row lookups.\n\n"
        "When showing percentages or comparisons, toggle the appropriate computed columns "
        "(pctOfTotal, burnRate, variancePct, rank) so the user can see them in the table.\n\n"
        "Reply in 1-2 sentences. Don't repeat what the table shows."
    ),
    tools=[query_budget, display_budget, reset_display],
)
