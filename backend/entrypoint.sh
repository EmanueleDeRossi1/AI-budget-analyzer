#!/bin/sh
set -e
python manage.py migrate --noinput
python manage.py shell -c "
from budget.models import BudgetScenario
if not BudgetScenario.objects.exists():
    from django.core.management import call_command
    call_command('loaddata', 'budget/fixtures/initial_data.json')
"
exec uvicorn budget_analyst.asgi:application --host 0.0.0.0 --port 8000
