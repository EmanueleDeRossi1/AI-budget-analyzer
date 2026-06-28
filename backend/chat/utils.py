"""
Pure utility functions used by chat/views.py.
Kept separate so they can be unit-tested without importing the Agents SDK.
"""
import json


def tool_call_to_operation(name: str, arguments: str) -> dict | None:
    if name == "reset_display":
        return {"type": "operation", "id": "resetView", "params": {}}
    if name == "display_budget":
        args = json.loads(arguments)
        f = args.get("filters", {})
        params = {"sort_by": args.get("sort_by", "variance"), "sort_dir": args.get("sort_dir", "desc")}
        if f.get("period"):      params["periods"]     = f["period"]
        if f.get("department"):  params["departments"] = f["department"]
        if f.get("category"):    params["categories"]  = f["category"]
        if args.get("group_by"): params["group_by"]    = args["group_by"]
        if args.get("columns"):  params["columns"]     = args["columns"]
        return {"type": "operation", "id": "updateView", "params": params}
    return None
