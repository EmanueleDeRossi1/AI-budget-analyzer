from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="BudgetScenario",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("period", models.CharField(max_length=50)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="BudgetLineItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scenario", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="line_items", to="budget.budgetscenario")),
                ("department", models.CharField(max_length=100)),
                ("category", models.CharField(max_length=100)),
                ("budget_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("actual_amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("notes", models.TextField(blank=True)),
            ],
            options={"ordering": ["department", "category"]},
        ),
    ]
