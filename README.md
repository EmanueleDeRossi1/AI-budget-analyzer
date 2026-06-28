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

## Stack

The backend is Django: a REST API for managing scenarios and line items, and a streaming chat endpoint that runs an AI agent (OpenAI Agents SDK, `o4-mini`) over Server-Sent Events.

The frontend is Next.js: a budget table and a chat panel side by side. The agent declares what it wants to show; the frontend applies it to the table live. For UI, I leaned on existing libraries rather than building custom: assistant-ui for the chat panel (streaming tool-call rendering out of the box) and Mantine for everything else (clean, data-dense components that look good without much work).

For the AI, I used OpenAI Agents SDK with `o4-mini`. The SDK handles  a lot of boilerplate: function-tool schema generation, streaming event types, and the run loop. Raw agent calls would have required wiring all of that manually.

## Architecture and trade-offs

The key design choice is the separation between `query_budget` (data access) and `display_budget` (view control). The agent never directly mutates UI state — it declares intent, and the frontend executes it through an operations registry. This keeps the agent from owning render state and makes it easy to add new table operations without touching the agent.

Trade-offs made under time constraints:

- **All state lives in `page.tsx`.** Works fine at this scale, but would need a store as the app grows.
- **No optimistic updates.** Edits wait for a server round-trip and full refetch.
- **`query_budget` results are stubbed in message history.** Prior tool results are replaced with `[data fetched — will re-query]` before being sent back to the model. This keeps the context window small; the agent re-queries fresh data as needed.
- **The agent can't edit data.** Write operations are intentionally human-only — letting the agent mutate rows would require confirmation flows and rollback logic that are out of scope here.
- **Swapping the LLM provider requires touching the agent and the SSE stream handling.** There's no abstraction layer between the Agents SDK and the rest of the backend.

## Known limitations

- Dimension values (department, category) are free-text strings with no controlled vocabulary. The agent uses exact-match filtering, so inconsistent casing in the data will produce wrong results. Custom dimensions aren't supported — the schema is fixed.
- Arithmetic is delegated to the model, not computed deterministically. The pre-computed `variance` and `variance_pct` fields in `query_budget` reduce this risk but don't eliminate it.
- Chat history is in-memory only; a page refresh starts a fresh conversation.
- The frontend runs `next dev` in Docker, which is fine for review but not optimized for production.

## What I'd add with more time

- Persist chat turns linked to a scenario and restore them on page load.
- Cross-scenario comparison — the data model supports multiple scenarios but the UI and agent are scoped to one at a time. It would be nice to allow for analysis across different scenarios.
- CSV import — the main complexity is column mapping (which field is budget vs. actual) and normalizing free-text dimension values, which makes it a non-trivial feature.
- User-defined dimensions to replace the hardcoded `department` / `category` fields, which would make the tool domain-agnostic.
