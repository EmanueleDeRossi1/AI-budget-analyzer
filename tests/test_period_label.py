"""
Tests for _current_period_label — the function that tells the agent
which period is "now" for a given scenario type.

Pinning the date to a fixed value so tests don't drift with the calendar.
"""
from datetime import date
from unittest.mock import patch
import pytest

from chat.utils import current_period_label as _current_period_label


@pytest.mark.parametrize("period_type, mock_date, expected", [
    # Quarter boundaries
    ("quarter", date(2026, 1, 1),  "Q1 2026"),
    ("quarter", date(2026, 3, 31), "Q1 2026"),
    ("quarter", date(2026, 4, 1),  "Q2 2026"),
    ("quarter", date(2026, 6, 30), "Q2 2026"),
    ("quarter", date(2026, 7, 1),  "Q3 2026"),
    ("quarter", date(2026, 10, 1), "Q4 2026"),
    ("quarter", date(2026, 12, 31),"Q4 2026"),
    # Half-year boundaries
    ("half", date(2026, 6, 30), "H1 2026"),
    ("half", date(2026, 7, 1),  "H2 2026"),
    # Month
    ("month", date(2026, 6, 15), "Jun 2026"),
    ("month", date(2026, 1, 1),  "Jan 2026"),
    ("month", date(2026, 12, 31),"Dec 2026"),
    # Year
    ("year", date(2026, 6, 15), "2026"),
])
def test_current_period_label(period_type, mock_date, expected):
    with patch("chat.utils._date") as mock_d:
        mock_d.today.return_value = mock_date
        assert _current_period_label(period_type) == expected
