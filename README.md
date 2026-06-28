# BudgetAI

A full-stack workspace for reviewing budget scenarios with an AI assistant. Create scenarios, manage line items, and ask natural-language questions — the assistant queries the real data and updates the table live.

## Quick start

**Prerequisites:** Docker Desktop (or Docker Engine + Compose v2)

```bash
cp .env.example .env
# Set OPENAI_API_KEY in .env
docker-compose up
```

Open http://localhost:3000. A demo scenario loads automatically.

## Environment variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | **Required.** Your OpenAI key. |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | Postgres credentials (defaults in `.env.example` work locally) |
| `DATABASE_URL` | Full Postgres connection string |
| `DJANGO_SECRET_KEY` | Change in production |
| `DJANGO_DEBUG` | `True` for local dev |
| `NEXT_PUBLIC_API_URL` | Backend base URL seen by the browser (`http://localhost:8000` for local) |

## Testing

Tests live in `backend/tests/`. They use pytest + pytest-django and run against SQLite — no running containers needed.

```bash
cd backend
pip install -r requirements.txt
pytest
```

To run inside Docker (same environment as production):

```bash
docker-compose run --rm backend pytest
```

Test files and what they cover:

- `test_period_label.py` — `current_period_label`: all four period types, quarter/half boundaries
- `test_tool_call_to_operation.py` — SSE operation mapping for `display_budget` (filters, sort, group_by, columns) and `reset_display`
- `test_query_budget.py` — variance math (under/over budget, zero-budget edge case), burn rate, pct_of_total, dimension filters, `min/max_variance_pct` thresholds, group-by aggregation, scenario isolation
- `test_api.py` — scenario CRUD, line item `?scenario=` filter, cascade delete, invalid period_type rejection
- `test_chat_endpoint.py` — missing `scenario_id` → 400, GET not allowed → 405

The pure-function tests (`test_period_label`, `test_tool_call_to_operation`) import from `chat/utils.py` rather than `chat/views.py` so the Agents SDK is never loaded during the test run.

## What's built

**Backend** — Django REST Framework + PostgreSQL + uvicorn (ASGI)
- CRUD for `BudgetScenario` and `BudgetLineItem`
- `/api/chat/` streams Server-Sent Events via `StreamingHttpResponse`
- OpenAI Agents SDK agent (`o4-mini`) with three tools: `query_budget`, `display_budget`, `reset_display`

**Frontend** — Next.js + TypeScript + Mantine + assistant-ui
- Inline-editable budget table with filter bar, stats bar, and computed columns
- Chat panel (assistant-ui) connected to the SSE stream
- Operations registry: SSE events from the agent map to live table mutations (filter, group, sort, toggle columns)

## AI approach

Used the **OpenAI Agents SDK** with `o4-mini`. The agent has three tools:

- `query_budget` — the only data-access path; queries the DB with optional filters and group-by aggregation
- `display_budget` — doesn't fetch data; emits an `updateView` operation over SSE that the frontend executes to update the table
- `reset_display` — emits a `resetView` operation to restore the default view

The split between data access (`query_budget`) and view control (`display_budget`) keeps the agent from owning render state. The frontend's operation registry is the single source of truth for what the table shows; the AI is a client of it.

Chose the Agents SDK over raw `openai` calls for clean function-tool schema generation and fine-grained streaming events (tool call, tool result, text delta) with minimal boilerplate.

## Architecture

```
Browser
  └── Next.js
        ├── page.tsx            — root state (scenarios, line items, filterSpec)
        ├── BudgetTable         — renders visibleRows derived from filterSpec
        ├── FilterBar           — manual filter controls; calls dispatch()
        ├── ChartStrip          — Recharts mini-charts above the table
        ├── lib/filterSpec.ts   — applyFilterSpec: filtering, n-level grouping, sorting
        ├── lib/operations/     — operation registry (setFilter, setGroupBy, sort, columns…)
        └── RuntimeProvider     — assistant-ui adapter; streams SSE, dispatches operations
              │  POST /api/chat/
              │  ← SSE: text delta | tool_call | tool_result | operation
              ▼
Django (ASGI / uvicorn)
  ├── /api/scenarios/, /api/line-items/  ← DRF viewsets (full CRUD)
  └── /api/chat/  ← StreamingHttpResponse
        └── Agents SDK Runner → Agent (o4-mini)
              ├── query_budget   → ORM → Postgres (filters, group-by, variance math)
              ├── display_budget → translates args into an SSE operation event
              └── reset_display  → emits resetView operation event
```

**Key design choice:** `display_budget` does nothing on the backend — `chat/views.py` translates its arguments into an SSE `operation` event that the frontend executes via the operations registry. The agent declares intent; the frontend owns render state.

## What the agent can and cannot do

**Can do:**
- Query and aggregate budget data by department, category, period, or any combination
- Filter by variance threshold (e.g. "everything more than 20% over budget") via `min/max_variance_pct`
- Update the table view: filter, group, sort, toggle computed columns (`burnRate`, `pctOfTotal`, `variancePct`, `rank`)
- Resolve relative time references ("this quarter", "this month") — current period is injected at request time
- Answer questions using pre-computed fields: `variance_pct`, `burn_rate`, `pct_of_total`
- Drill into what's driving a number (e.g. Engineering overspend → group by category within Engineering)

**Cannot do:**
- Write or modify budget data
- Compare across scenarios
- Model hypotheticals / what-if scenarios
- Know what the user currently sees in the table (display is fire-and-forget)

## Assumptions and limitations

- No authentication — all data is globally visible
- Chat history is in-memory only; page refresh starts a fresh conversation
- Frontend runs `next dev` in Docker (fine for review, not optimized for production)

## Small note

Message history sent to the backend includes tool calls, but `query_budget` results are replaced with a `[data fetched — will re-query]` placeholder instead of the full budget JSON. This keeps the context window lean across long conversations while still giving the model visibility into previous `display_budget` / `reset_display` calls — so it retains display-state continuity without carrying stale data payloads into every subsequent turn.

## What I'd improve with more time

- Persist chat turns linked to a scenario and restore on page load
- Stream tool-call status in the chat panel ("querying budget data…")
- Chart widget (bar chart by department/period) alongside the table
- "Apply suggestion" flow: when the agent proposes a budget change, confirm and write it back via the API
- Swap `o4-mini` for `gpt-4o` for more reliable multi-tool instruction-following
- Production Dockerfile: `next build && next start`, gunicorn workers, `DJANGO_DEBUG=False`
