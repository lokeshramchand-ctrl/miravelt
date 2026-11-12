"""The one clock the product reasons in.

Every Google Pay statement this app parses prints Indian local times, and
every user-facing "day" or "month" (charts, month-over-month, recurring
cadence) means that local day - not the UTC day the timestamp happens to be
stored in. A payment at 02:00 IST is stored as 20:30 UTC the previous day; an
aggregation that groups by the UTC date puts it on the wrong day.

So: store UTC (every datetime in models/schemas.py is UTC-aware), but group,
bucket and compare dates in APP_TZ. Mongo aggregations pass APP_TZ_NAME as
the `timezone` of $dateToString/$dateTrunc; Python code uses APP_TZ. The
mobile client formats in the same zone (frontend/src/lib/format.ts), so a
phone abroad still shows the time printed on the statement.
"""
from datetime import UTC, date, datetime, time, timedelta, timezone

APP_TZ_NAME = "Asia/Kolkata"
# India has no DST, so a fixed offset is exact and needs no tzdata on the host.
APP_TZ = timezone(timedelta(hours=5, minutes=30), name="IST")


def local_date(moment: datetime) -> date:
    """The calendar date `moment` falls on in APP_TZ."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(APP_TZ).date()


def start_of_local_day(day: date) -> datetime:
    """UTC instant at which `day` begins in APP_TZ."""
    return datetime.combine(day, time.min, tzinfo=APP_TZ).astimezone(UTC)


def end_of_local_day_exclusive(day: date) -> datetime:
    """UTC instant at which the day after `day` begins in APP_TZ - use with `$lt`."""
    return start_of_local_day(day + timedelta(days=1))


def local_month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    """[start, end) of a calendar month in APP_TZ, as UTC instants."""
    start = start_of_local_day(date(year, month, 1))
    end = start_of_local_day(date(year + (month == 12), month % 12 + 1, 1))
    return start, end
