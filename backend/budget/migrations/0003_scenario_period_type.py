from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("budget", "0002_move_period_to_line_item"),
    ]

    operations = [
        migrations.AddField(
            model_name="budgetscenario",
            name="period_type",
            field=models.CharField(
                choices=[
                    ("year",    "Year"),
                    ("half",    "Half-year"),
                    ("quarter", "Quarter"),
                    ("month",   "Month"),
                    ("custom",  "Custom"),
                ],
                default="quarter",
                max_length=10,
            ),
        ),
    ]
