import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from ..auth import current_user_id
from ..db import connect
from ..schemas import CalendarEntry, CalendarSettings, PlanRequest

router = APIRouter(tags=["calendar"])

CARD_SIZES = {"compact", "medium", "large"}


def _parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "Date must be formatted as YYYY-MM-DD.")


def _month_bounds(month: str) -> tuple[date, date]:
    """`month` is yyyy-MM; returns [first, first-of-next-month)."""
    try:
        year, mon = (int(part) for part in month.split("-"))
        start = date(year, mon, 1)
    except (ValueError, TypeError):
        raise HTTPException(400, "Month must be formatted as YYYY-MM.")
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


@router.get("/api/calendar", response_model=list[CalendarEntry])
def list_entries(month: str | None = None, user_id: str = Depends(current_user_id)):
    """`month` is yyyy-MM; omit it to get every planned day."""
    with connect() as conn:
        if month:
            start, end = _month_bounds(month)
            rows = conn.execute(
                """SELECT date, outfit_id, note FROM calendar_entries
                    WHERE user_id = %s AND date >= %s AND date < %s ORDER BY date""",
                (user_id, start, end),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT date, outfit_id, note FROM calendar_entries
                    WHERE user_id = %s ORDER BY date""",
                (user_id,),
            ).fetchall()
    return [
        CalendarEntry(date=r["date"].isoformat(), outfitId=r["outfit_id"], note=r["note"])
        for r in rows
    ]


@router.put("/api/calendar", response_model=CalendarEntry)
def plan_day(body: PlanRequest, user_id: str = Depends(current_user_id)):
    day = _parse_date(body.date)
    with connect() as conn:
        outfit = conn.execute(
            "SELECT id FROM outfits WHERE id = %s AND user_id = %s", (body.outfitId, user_id)
        ).fetchone()
        if outfit is None:
            raise HTTPException(404, "Outfit not found")

        # Planning a look keeps it out of the next suggestion sweep.
        conn.execute("UPDATE outfits SET status = 'saved' WHERE id = %s", (body.outfitId,))
        conn.execute(
            """INSERT INTO calendar_entries (id, user_id, date, outfit_id, note)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (user_id, date)
               DO UPDATE SET outfit_id = excluded.outfit_id, note = excluded.note""",
            (uuid.uuid4().hex, user_id, day, body.outfitId, body.note.strip()[:200]),
        )
    return CalendarEntry(date=body.date, outfitId=body.outfitId, note=body.note)


@router.delete("/api/calendar/{entry_date}", status_code=204)
def clear_day(entry_date: str, user_id: str = Depends(current_user_id)):
    day = _parse_date(entry_date)
    with connect() as conn:
        conn.execute(
            "DELETE FROM calendar_entries WHERE user_id = %s AND date = %s", (user_id, day)
        )


# --------------------------------------------------------------------------
# Per-user calendar preferences
# --------------------------------------------------------------------------

def _row_to_settings(row) -> CalendarSettings:
    return CalendarSettings(
        weekStartsOn=row["week_starts_on"],
        cardSize=row["card_size"],
        showWeather=row["show_weather"],
        showStreak=row["show_streak"],
        showItemDots=row["show_item_dots"],
        highlightToday=row["highlight_today"],
    )


@router.get("/api/calendar-settings", response_model=CalendarSettings)
def get_settings(user_id: str = Depends(current_user_id)):
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM calendar_settings WHERE user_id = %s", (user_id,)
        ).fetchone()
        if row is None:
            # Accounts created before this table existed have no row yet.
            conn.execute("INSERT INTO calendar_settings (user_id) VALUES (%s)", (user_id,))
            row = conn.execute(
                "SELECT * FROM calendar_settings WHERE user_id = %s", (user_id,)
            ).fetchone()
    return _row_to_settings(row)


@router.put("/api/calendar-settings", response_model=CalendarSettings)
def update_settings(body: CalendarSettings, user_id: str = Depends(current_user_id)):
    if body.cardSize not in CARD_SIZES:
        raise HTTPException(400, f"cardSize must be one of {sorted(CARD_SIZES)}")

    with connect() as conn:
        conn.execute(
            """INSERT INTO calendar_settings
               (user_id, week_starts_on, card_size, show_weather, show_streak,
                show_item_dots, highlight_today)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id) DO UPDATE SET
                   week_starts_on  = excluded.week_starts_on,
                   card_size       = excluded.card_size,
                   show_weather    = excluded.show_weather,
                   show_streak     = excluded.show_streak,
                   show_item_dots  = excluded.show_item_dots,
                   highlight_today = excluded.highlight_today""",
            (
                user_id, body.weekStartsOn, body.cardSize, body.showWeather,
                body.showStreak, body.showItemDots, body.highlightToday,
            ),
        )
        row = conn.execute(
            "SELECT * FROM calendar_settings WHERE user_id = %s", (user_id,)
        ).fetchone()
    return _row_to_settings(row)
