"""Stylist chat.

Replies stream back as SSE. EventSource cannot POST, so the client reads the
response body with fetch + a stream reader instead — same wire format, one round
trip. Both the user message and the finished reply are persisted, so reloading
the page restores the conversation exactly.
"""

import json
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from .. import gemini
from ..auth import current_user
from ..db import connect
from ..schemas import ChatMessage, ChatThread, ChatThreadDetail, SendMessage

router = APIRouter(prefix="/api/chat", tags=["chat"])

# How much of the conversation to replay as context. Keeps long threads from
# growing the prompt without bound.
HISTORY_TURNS = 20


def _row_to_thread(row) -> ChatThread:
    return ChatThread(
        id=row["id"],
        title=row["title"],
        createdAt=row["created_at"].isoformat(),
        updatedAt=row["updated_at"].isoformat(),
    )


def _row_to_message(row) -> ChatMessage:
    return ChatMessage(
        id=row["id"],
        role=row["role"],
        content=row["content"],
        createdAt=row["created_at"].isoformat(),
    )


def _own_thread(conn, thread_id: str, user_id: str):
    row = conn.execute(
        "SELECT * FROM chat_threads WHERE id = %s AND user_id = %s", (thread_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Conversation not found")
    return row


@router.get("/threads", response_model=list[ChatThread])
def list_threads(user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM chat_threads WHERE user_id = %s ORDER BY updated_at DESC",
            (user["id"],),
        ).fetchall()
    return [_row_to_thread(r) for r in rows]


@router.get("/threads/{thread_id}", response_model=ChatThreadDetail)
def get_thread(thread_id: str, user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        thread = _own_thread(conn, thread_id, user["id"])
        messages = conn.execute(
            "SELECT * FROM chat_messages WHERE thread_id = %s ORDER BY created_at",
            (thread_id,),
        ).fetchall()
    return ChatThreadDetail(
        **_row_to_thread(thread).model_dump(),
        messages=[_row_to_message(m) for m in messages],
    )


@router.delete("/threads/{thread_id}", status_code=204)
def delete_thread(thread_id: str, user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        conn.execute(
            "DELETE FROM chat_threads WHERE id = %s AND user_id = %s", (thread_id, user["id"])
        )


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


@router.post("/messages")
def send_message(body: SendMessage, user: dict[str, Any] = Depends(current_user)):
    message = body.message.strip()
    if not message:
        raise HTTPException(400, "Message cannot be empty.")
    if len(message) > 4000:
        raise HTTPException(400, "Message is too long (4000 characters max).")

    user_id = user["id"]

    with connect() as conn:
        if body.threadId:
            thread = _own_thread(conn, body.threadId, user_id)
            thread_id, is_new = thread["id"], False
        else:
            thread_id, is_new = uuid.uuid4().hex, True
            conn.execute(
                "INSERT INTO chat_threads (id, user_id, title) VALUES (%s, %s, %s)",
                (thread_id, user_id, message.split("\n")[0][:48] or "New chat"),
            )

        user_message_id = uuid.uuid4().hex
        conn.execute(
            "INSERT INTO chat_messages (id, thread_id, role, content) VALUES (%s, %s, 'user', %s)",
            (user_message_id, thread_id, message),
        )

        history = [
            {"role": r["role"], "content": r["content"]}
            for r in conn.execute(
                """SELECT role, content FROM chat_messages
                    WHERE thread_id = %s AND id <> %s
                    ORDER BY created_at DESC LIMIT %s""",
                (thread_id, user_message_id, HISTORY_TURNS),
            ).fetchall()
        ][::-1]

        items = conn.execute(
            """SELECT category, brand, description, color, is_wishlist
                 FROM closet_items WHERE user_id = %s ORDER BY created_at DESC LIMIT 200""",
            (user_id,),
        ).fetchall()

    def stream():
        yield _sse({"type": "thread", "threadId": thread_id, "userMessageId": user_message_id})

        parts: list[str] = []
        try:
            for chunk in gemini.chat_stream(user, list(items), history, message):
                parts.append(chunk)
                yield _sse({"type": "delta", "text": chunk})
        except gemini.GeminiNotConfigured as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return
        except Exception as exc:
            yield _sse({"type": "error", "message": f"Closei could not reply: {exc}"})
            return

        reply = "".join(parts).strip()
        if not reply:
            yield _sse({"type": "error", "message": "Closei had nothing to say. Try rephrasing."})
            return

        reply_id = uuid.uuid4().hex
        with connect() as conn:
            conn.execute(
                """INSERT INTO chat_messages (id, thread_id, role, content)
                   VALUES (%s, %s, 'assistant', %s)""",
                (reply_id, thread_id, reply),
            )
            # Only name the thread once the first exchange actually succeeded,
            # so an errored first message does not leave a titled empty thread.
            title = gemini.title_for(message) if is_new else None
            conn.execute(
                "UPDATE chat_threads SET updated_at = now(), title = COALESCE(%s, title) "
                "WHERE id = %s",
                (title, thread_id),
            )

        yield _sse({"type": "done", "messageId": reply_id, "title": title})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        # Without this an nginx/ngrok layer in front will buffer the whole reply
        # and the stream arrives as one lump.
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
