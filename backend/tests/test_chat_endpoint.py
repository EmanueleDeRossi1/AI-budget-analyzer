"""
Tests for the /api/chat/ endpoint — input validation and SSE response shape.
We don't invoke the actual LLM; we test the guardrails around it.
"""
import json
import pytest
from django.test import AsyncClient

from budget.models import BudgetScenario


@pytest.mark.django_db
class TestChatEndpointValidation:
    def setup_method(self):
        self.client = AsyncClient()

    @pytest.mark.asyncio
    async def test_missing_scenario_id_returns_400(self):
        res = await self.client.post(
            "/api/chat/",
            data=json.dumps({"messages": []}),
            content_type="application/json",
        )
        assert res.status_code == 400
        body = json.loads(res.content)
        assert "scenario_id" in body["error"]

    @pytest.mark.asyncio
    async def test_get_not_allowed(self):
        res = await self.client.get("/api/chat/")
        assert res.status_code == 405
