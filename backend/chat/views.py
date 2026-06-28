import json
from datetime import date as _date
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from asgiref.sync import sync_to_async
from agents import Runner
from budget.models import BudgetScenario
from .agent import agent, AgentContext
from .utils import current_period_label, tool_call_to_operation


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@csrf_exempt
@require_POST
async def chat(request):
    data = json.loads(request.body)
    scenario_id = data.get("scenario_id")
    if not scenario_id:
        return JsonResponse({"error": "scenario_id is required"}, status=400)

    context = AgentContext(scenario_id=scenario_id)

    scenario = await sync_to_async(BudgetScenario.objects.get)(id=scenario_id)
    current_period = current_period_label(scenario.period_type)
    today_str = _date.today().strftime('%B %d, %Y')
    context_msg = {
        "role": "system",
        "content": f"Today is {today_str}. The current period for this scenario is: {current_period}.",
    }
    messages = [context_msg] + data.get("messages", [])

    async def stream():
        try:
            result = Runner.run_streamed(agent, messages, context=context)
            async for event in result.stream_events():
                if event.type == "run_item_stream_event":
                    item = event.item
                    item_type = getattr(item, "type", None)

                    if item_type == "tool_call_item":
                        raw = getattr(item, "raw_item", None)
                        if raw and getattr(raw, "type", None) == "function_call":
                            yield _sse({"type": "tool_call", "id": raw.call_id, "name": raw.name, "args": raw.arguments})
                            op = tool_call_to_operation(raw.name, raw.arguments)
                            if op:
                                yield _sse(op)

                    elif item_type == "tool_call_output_item":
                        raw = getattr(item, "raw_item", None)
                        call_id = raw.get("call_id") if isinstance(raw, dict) else getattr(raw, "call_id", None)
                        if call_id:
                            yield _sse({"type": "tool_result", "id": call_id, "result": str(item.output)})

                elif event.type == "raw_response_event":
                    if getattr(event.data, "type", "") == "response.output_text.delta":
                        delta = getattr(event.data, "delta", None)
                        if isinstance(delta, str) and delta:
                            yield _sse({"type": "text", "delta": delta})

        except Exception as e:
            yield _sse({"type": "error", "message": str(e)})

        yield "data: [DONE]\n\n"

    return StreamingHttpResponse(
        stream(),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
