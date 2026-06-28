import json
import asyncio
import queue
import threading
from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from agents import Runner
from .agent import agent, AgentContext


# ── Chat view ─────────────────────────────────────────────────────────────────

@csrf_exempt
@require_POST
def chat(request):
    data = json.loads(request.body)
    scenario_id = data.get("scenario_id")
    if not scenario_id:
        return JsonResponse({"error": "scenario_id is required"}, status=400)

    messages = data.get("messages", [])

    # Thread-safe queue bridging the async agent loop to Django's sync stream.
    # None is the sentinel that signals end-of-stream.
    q: queue.Queue[str | None] = queue.Queue()

    def push(payload: dict) -> None:
        q.put(f"data: {json.dumps(payload)}\n\n")

    # All events share the same shape: { type, ...payload }
    # Frontend routes on `type` — adding a new tool never requires changing this.
    context = AgentContext(
        scenario_id=scenario_id,
        emit=lambda op_id, params: push({"type": "operation", "id": op_id, "params": params}),
    )

    async def _run():
        try:
            result = Runner.run_streamed(agent, messages, context=context)
            async for event in result.stream_events():

                if event.type == "run_item_stream_event":
                    item = event.item
                    item_type = getattr(item, "type", None)

                    if item_type == "tool_call_item":
                        raw = getattr(item, "raw_item", None)
                        # Only surface function calls (not file-search, computer-use, etc.)
                        if raw and getattr(raw, "type", None) == "function_call":
                            push({
                                "type": "tool_call",
                                "id": raw.call_id,
                                "name": raw.name,
                                "args": raw.arguments,  # JSON string
                            })

                    elif item_type == "tool_call_output_item":
                        raw = getattr(item, "raw_item", None)
                        call_id = raw.get("call_id") if isinstance(raw, dict) else getattr(raw, "call_id", None)
                        if call_id:
                            push({
                                "type": "tool_result",
                                "id": call_id,
                                "result": str(item.output),
                            })

                elif event.type == "raw_response_event":
                    if getattr(event.data, "type", "") == "response.output_text.delta":
                        delta = getattr(event.data, "delta", None)
                        if isinstance(delta, str) and delta:
                            push({"type": "text", "delta": delta})

        except Exception as e:
            push({"type": "error", "message": str(e)})
        finally:
            q.put(None)

    threading.Thread(target=lambda: asyncio.run(_run()), daemon=True).start()

    def stream():
        while True:
            chunk = q.get()
            if chunk is None:
                yield "data: [DONE]\n\n"
                break
            yield chunk

    return StreamingHttpResponse(
        stream(),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
