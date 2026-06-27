import json
from dataclasses import dataclass
from typing import Callable
from openai.types.shared import Reasoning
from agents import Agent, ModelSettings, function_tool, RunContextWrapper
from asgiref.sync import sync_to_async
from budget.models import BudgetLineItem


# ── Agent context ─────────────────────────────────────────────────────────────
# Passed into every tool call.
# - scenario_id: keeps it out of the message text entirely
# - emit(event_type, payload): generic channel for command tools to push
#   declarative UI specs back to the frontend via SSE. Adding a new command
#   tool never requires changing this dataclass — just call emit with a new
#   event type and handle it in the frontend.

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
            variance = item.actual_amount - item.budget_amount
            pct = (variance / item.budget_amount * 100) if item.budget_amount else 0
            result.append({
                "period": item.period,
                "department": item.department,
                "category": item.category,
                "budget": float(item.budget_amount),
                "actual": float(item.actual_amount),
                "variance": float(variance),
                "variance_pct": round(float(pct), 1),
                "over_budget": variance > 0,
            })
        return result

    return json.dumps(await sync_to_async(_fetch)())


@function_tool
async def aggregate(
    ctx: RunContextWrapper[AgentContext],
    operation: str,
    field: str = "actual",
    group_by: str | None = None,
    department: str | None = None,
    category: str | None = None,
    period: str | None = None,
    over_budget: bool = False,
) -> str:
    """
    Compute a summary statistic over budget line items. Use this for any question
    that requires arithmetic — don't calculate in your head.

    operation:
      "sum"           — total of field across matching rows
      "count"         — number of matching rows
      "pct_of_budget" — actual / budget * 100 (burn rate)
      "pct_of_total"  — group actual / total scenario actual * 100

    field: "actual" | "budget" | "variance"  (used by "sum" only)
    group_by: "department" | "category" | "period" | null
    department: filter to this department (exact name from get_budget_data)
    category: filter to this category (exact name from get_budget_data)
    period: filter to this period (exact value from get_budget_data)
    over_budget: if true, only include items where actual > budget

    Examples:
      Total actual per dept:      operation="sum", field="actual", group_by="department"
      How many items over budget: operation="count", over_budget=true
      Marketing burn rate:        operation="pct_of_budget", department="Marketing"
      Each dept share of spend:   operation="pct_of_total", group_by="department"
      Q1 vs Q2 spend:             operation="sum", field="actual", group_by="period"
    """
    def _compute():
        all_items = list(BudgetLineItem.objects.filter(scenario_id=ctx.context.scenario_id))
        items = all_items
        if department:
            items = [i for i in items if i.department == department]
        if category:
            items = [i for i in items if i.category == category]
        if period:
            items = [i for i in items if i.period == period]
        if over_budget:
            items = [i for i in items if i.actual_amount > i.budget_amount]

        def field_val(item):
            if field == "budget":   return float(item.budget_amount)
            if field == "variance": return float(item.actual_amount - item.budget_amount)
            return float(item.actual_amount)

        total_actual = sum(float(i.actual_amount) for i in all_items)

        def compute(rows):
            if operation == "sum":
                return round(sum(field_val(i) for i in rows), 2)
            if operation == "count":
                return len(rows)
            if operation == "pct_of_budget":
                b = sum(float(i.budget_amount) for i in rows)
                a = sum(float(i.actual_amount) for i in rows)
                return round(a / b * 100, 1) if b else None
            if operation == "pct_of_total":
                a = sum(float(i.actual_amount) for i in rows)
                return round(a / total_actual * 100, 1) if total_actual else None
            raise ValueError(f"Unknown operation: {operation!r}")

        if group_by in ("department", "category", "period"):
            groups: dict = {}
            for item in items:
                key = getattr(item, group_by)
                groups.setdefault(key, []).append(item)
            return {k: compute(v) for k, v in groups.items()}

        return compute(items)

    return json.dumps(await sync_to_async(_compute)())


@function_tool
def set_filter(
    ctx: RunContextWrapper[AgentContext],
    departments: list[str] = [],
    categories: list[str] = [],
    periods: list[str] = [],
    group_by: list[str] = [],
    sort_by: str = "variance",
    sort_dir: str = "desc",
) -> str:
    """
    Update the budget table view. Call after get_budget_data, using only
    exact values that appear in the returned data.

    departments: filter to these departments (empty = all)
    categories: filter to these categories (empty = all)
    periods: filter to these periods (empty = all)
    group_by: ordered list of dimensions, e.g. ["period", "department"] or ["department", "category"]
              valid values: "period", "department", "category"
    sort_by: "variance" | "budget" | "actual"
    sort_dir: "desc" | "asc"
    """
    spec: dict = {"sort_by": sort_by, "sort_dir": sort_dir}
    if departments:
        spec["departments"] = departments
    if categories:
        spec["categories"] = categories
    if periods:
        spec["periods"] = periods
    valid_group = [g for g in group_by if g in ("period", "department", "category")]
    if valid_group:
        spec["group_by"] = valid_group

    ctx.context.emit("filter_spec", spec)
    return "Filter applied."


# ── Agent ─────────────────────────────────────────────────────────────────────

agent = Agent(
    name="Budget Analyst",
    model="o4-mini",
    # model_settings=ModelSettings(
    #     reasoning=Reasoning(effort="medium", summary="auto")
    # ),
    instructions=(
        "You are a finance analyst. Query tools fetch and compute data; command tools update the UI. "
        "Run query tools before command tools.\n\n"
        "Use only exact period/department/category values from the data, and use aggregate for all arithmetic.\n\n"
        "Reply in 1-2 sentences. Never repeat what the table shows. Confirm what you applied; "
        "add a second sentence only if something is notable."
    ),
    tools=[get_budget_data, aggregate, set_filter],
)
