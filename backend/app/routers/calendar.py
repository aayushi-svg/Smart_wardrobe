import uuid

from fastapi import APIRouter, HTTPException

from ..config import DEMO_USER_ID
from ..db import connect
from ..schemas import CalendarEntry, PlanRequest

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEntry])
def list_entries(month: str | None = None):
    """`month` is yyyy-MM; omit it to get every planned day."""
    with connect() as conn:
        if month:
            rows = conn.execute(
                "SELECT date, outfit_id FROM calendar_entries WHERE user_id = ? AND date LIKE ?",
                (DEMO_USER_ID, f"{month}-%"),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT date, outfit_id FROM calendar_entries WHERE user_id = ?",
                (DEMO_USER_ID,),
            ).fetchall()
    return [CalendarEntry(date=r["date"], outfitId=r["outfit_id"]) for r in rows]


@router.put("", response_model=CalendarEntry)
def plan_day(body: PlanRequest):
    with connect() as conn:
        outfit = conn.execute(
            "SELECT id FROM outfits WHERE id = ? AND user_id = ?", (body.outfitId, DEMO_USER_ID)
        ).fetchone()
        if outfit is None:
            raise HTTPException(404, "Outfit not found")

        # Planning a look keeps it out of the next suggestion sweep.
        conn.execute("UPDATE outfits SET status = 'saved' WHERE id = ?", (body.outfitId,))
        conn.execute(
            """INSERT INTO calendar_entries (id, user_id, date, outfit_id)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (user_id, date) DO UPDATE SET outfit_id = excluded.outfit_id""",
            (uuid.uuid4().hex, DEMO_USER_ID, body.date, body.outfitId),
        )
    return CalendarEntry(date=body.date, outfitId=body.outfitId)


@router.delete("/{date}", status_code=204)
def clear_day(date: str):
    with connect() as conn:
        conn.execute(
            "DELETE FROM calendar_entries WHERE user_id = ? AND date = ?", (DEMO_USER_ID, date)
        )
