from django.db import models


PERIOD_TYPE_CHOICES = [
    ('year',    'Year'),
    ('half',    'Half-year'),
    ('quarter', 'Quarter'),
    ('month',   'Month'),
]


class BudgetScenario(models.Model):
    name = models.CharField(max_length=255)
    period_type = models.CharField(max_length=10, choices=PERIOD_TYPE_CHOICES, default='quarter')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class BudgetLineItem(models.Model):
    scenario = models.ForeignKey(
        BudgetScenario, on_delete=models.CASCADE, related_name="line_items"
    )
    period = models.CharField(max_length=50, blank=True)  # e.g. "Q1", "Jan", "2026"
    department = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    budget_amount = models.DecimalField(max_digits=12, decimal_places=2)
    actual_amount = models.DecimalField(max_digits=12, decimal_places=2)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["period", "department", "category"]
