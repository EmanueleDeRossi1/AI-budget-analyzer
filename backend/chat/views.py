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

    # emit(event_type, payload) is how command tools push declarative UI specs
    # back to the frontend. The event_type becomes the SSE payload key, so the
    # frontend can dispatch on it directly. Adding a new command tool only
    # requires handling the new event_type in the frontend — nothing changes here.
    context = AgentContext(
        scenario_id=scenario_id,
        emit=lambda event_type, payload: push({event_type: payload}),
    )

    async def _run():
        try:
            result = Runner.run_streamed(agent, messages, context=context)
            async for event in result.stream_events():

                if event.type == "run_item_stream_event":
                    # Show a loading status while the DB query is in flight.
                    if getattr(event.item, "type", None) == "tool_call_item":
                        if "get_budget_data" in (getattr(event.item, "name", "") or ""):
                            push({"status": "Fetching budget data…"})

                elif event.type == "raw_response_event":
                    # The Responses API streams text and tool-argument tokens through
                    # the same event type. We only want text output deltas.
                    if getattr(event.data, "type", "") == "response.output_text.delta":
                        delta = getattr(event.data, "delta", None)
                        if isinstance(delta, str) and delta:
                            push({"text": delta})

        except Exception as e:
            push({"error": str(e)})
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
