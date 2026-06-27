from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budget", "0001_initial"),
    ]

    operations = [
        # Add period to line items (blank so existing rows get empty string)
        migrations.AddField(
            model_name="budgetlineitem",
            name="period",
            field=models.CharField(blank=True, max_length=50),
        ),
        # Remove period from scenario
        migrations.RemoveField(
            model_name="budgetscenario",
            name="period",
        ),
        # Update default ordering to include period
        migrations.AlterModelOptions(
            name="budgetlineitem",
            options={"ordering": ["period", "department", "category"]},
        ),
    ]
