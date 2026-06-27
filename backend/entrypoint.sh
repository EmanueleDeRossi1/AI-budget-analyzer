#!/bin/sh
set -e
python manage.py migrate --noinput
python manage.py shell -c "
from budget.models import BudgetScenario
if not BudgetScenario.objects.exists():
    from django.core.management import call_command
    call_command('loaddata', 'budget/fixtures/initial_data.json')
"
exec python manage.py runserver 0.0.0.0:8000
