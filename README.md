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
        ├── BudgetTable — driven by filterSpec
        └── RuntimeProvider (assistant-ui adapter)
              │  POST /api/chat/
              │  ← SSE: text delta | tool_call | operation
              ▼
Django (ASGI / uvicorn)
  ├── /api/scenarios/, /api/line-items/  ← DRF viewsets
  └── /api/chat/  ← StreamingHttpResponse
        └── Agents SDK Runner → Agent (o4-mini)
              ├── query_budget → ORM → Postgres
              ├── display_budget → operation event in SSE
              └── reset_display → operation event in SSE
```

**Key trade-off:** `display_budget` is a fire-and-forget SSE side-effect — the agent receives `"View updated."` while the browser independently receives and executes the operation. The agent cannot confirm what the user actually sees, but this keeps the agent prompt simple and avoids round-tripping render state through the LLM.

## Assumptions and limitations

- No authentication — all data is globally visible
- Chat history is in-memory only; page refresh starts a fresh conversation
- Frontend runs `next dev` in Docker (fine for review, not optimized for production)

## What I'd improve with more time

- Persist chat turns linked to a scenario and restore on page load
- Stream tool-call status in the chat panel ("querying budget data…")
- Chart widget (bar chart by department/period) alongside the table
- "Apply suggestion" flow: when the agent proposes a budget change, confirm and write it back via the API
- Swap `o4-mini` for `gpt-4o` for more reliable multi-tool instruction-following
- Production Dockerfile: `next build && next start`, gunicorn workers, `DJANGO_DEBUG=False`
