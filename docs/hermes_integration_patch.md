# Hermes → Mission Control integration patch

This document explains how to wire Hermes (the AI agent server) up to a freshly
provisioned Mission Control dashboard. Apply these steps to **each Hermes
deployment** after a new client's dashboard is up.

The dashboard is Hermes' single source of truth for everything the client sees:
activity, drafts awaiting approval, inter-agent comms, and memory health.

---

## 1. Add environment variables to Hermes `.env`

Drop in the values printed by Mission Control's `install.sh`:

```bash
DASHBOARD_URL=https://mission-control.<client-domain>
INGEST_API_KEY=<the key the dashboard generated>
```

## 2. Add a tiny dashboard client to Hermes' skills

Create one shared helper that every skill uses to POST into the dashboard:

```python
# hermes/skills/_dashboard.py  (new file)
import os, requests

DASHBOARD_URL  = os.environ["DASHBOARD_URL"].rstrip("/")
INGEST_API_KEY = os.environ["INGEST_API_KEY"]
_HEADERS = {
    "authorization": f"Bearer {INGEST_API_KEY}",
    "content-type": "application/json",
}

def post(path: str, body: dict) -> None:
    # Fire-and-forget — dashboard returns 202 immediately
    try:
        requests.post(f"{DASHBOARD_URL}{path}", json=body, headers=_HEADERS, timeout=5)
    except Exception as e:
        # Log locally, don't raise — agent operations shouldn't fail
        # if the dashboard is briefly unreachable.
        print(f"[dashboard] {path} failed: {e}")
```

Then add the four skill wrappers Hermes will call.

### `log_activity.py`

```python
from ._dashboard import post

def log_activity(agent_slug, action_type, description, metadata=None,
                 minutes_saved=0, revenue_event=False):
    post("/api/ingest/event", {
        "agent_slug": agent_slug,
        "action_type": action_type,       # READ | DRAFT | SEND | FLAG | MEMORY_UPDATE | AGENT_COMM
        "description": description,
        "metadata": metadata or {},
        "minutes_saved": minutes_saved,
        "revenue_event": revenue_event,
    })
```

### `flag_for_approval.py`

```python
from ._dashboard import post

def flag_for_approval(agent_slug, *, title, original_message, draft_text,
                      priority="MED", channel="email", metadata=None):
    post("/api/ingest/draft", {
        "agent_slug": agent_slug,
        "title": title,
        "original_message": original_message,
        "draft_text": draft_text,
        "priority": priority,             # HIGH | MED | LOW
        "channel": channel,               # email | skool | instagram_dm | …
        "metadata": metadata or {},
    })
```

### `inter_agent_comms.py`

```python
from ._dashboard import post

def record_comm(from_slug, to_slug, *, topic, question, answer):
    post("/api/ingest/agent-comm", {
        "from_agent_slug": from_slug,
        "to_agent_slug": to_slug,
        "topic": topic,
        "question": question,
        "answer": answer,
    })
```

### `update_memory.py`

```python
from ._dashboard import post

def memory_snapshot(memory_md_chars, user_md_chars):
    post("/api/ingest/memory", {
        "memory_md_chars": memory_md_chars,
        "user_md_chars": user_md_chars,
    })
```

Schedule `memory_snapshot()` on an hourly cron inside Hermes.

## 3. Receive approval decisions

The dashboard POSTs back to Hermes when a client approves or rejects a draft:

```
POST {HERMES_API_URL}/decision
Authorization: Bearer {HERMES_API_KEY}       # if you set HERMES_API_KEY

{
  "draft_id": "ckxxx…",
  "decision": "approved" | "rejected",
  "approved_text": "...",     // present on approved; may be the edited version
  "reason": "...",            // optional, on rejected
  "approved_by": "dashboard"  // or "slack"
}
```

Add a tiny FastAPI / Flask route to Hermes:

```python
# hermes/server.py
@app.post("/decision")
def decision(payload: dict):
    draft_id = payload["draft_id"]
    queued   = drafts_in_flight.pop(draft_id, None)
    if queued is None:
        return {"ok": False, "error": "unknown-draft"}
    if payload["decision"] == "approved":
        queued.send_with_text(payload.get("approved_text") or queued.draft_text)
    else:
        queued.discard(reason=payload.get("reason"))
    return {"ok": True}
```

`drafts_in_flight` is whatever your Hermes process uses to hold a pending
draft (in memory or in a local queue). When you call
`flag_for_approval(...)`, stash the prepared "send action" in that dict keyed
by the `draft_id` returned (you can use the same id Hermes generates, or — if
Hermes doesn't generate one — call the dashboard endpoint and read the id back
from the response).

## 4. Update the Hermes system prompt

Add (or replace the equivalent section of) the dashboard rules in Hermes'
system prompt:

```
- After every meaningful action, call the skill `log_activity(...)`.
  Choose one of: READ, DRAFT, SEND, FLAG, MEMORY_UPDATE, AGENT_COMM.
  Include `minutes_saved` when you replaced a manual task, and set
  `revenue_event` when the action created or preserved revenue.

- When you draft a reply that needs the client's approval, call
  `flag_for_approval(...)`. The dashboard will alert the client in Slack and
  reply to you on `/decision` with their answer. Do NOT send the reply
  yourself until you receive that callback.

- When you consult another agent to make a decision (e.g. asking Atlas about
  the cancellation policy), call `record_comm(...)`. This populates the
  inter-agent comms panel in the dashboard so the client can see your
  reasoning.

- Once an hour, call `memory_snapshot(...)` with the current sizes of
  MEMORY.MD and USER.MD. This keeps the MEMORY health bar accurate.
```

## 5. Restart Hermes

```bash
systemctl restart hermes      # or however you supervise the agent process
```

Watch Mission Control's dashboard — within a few seconds you should see the
first events stream in.

---

### Troubleshooting

- **401 on every POST** — `INGEST_API_KEY` in Hermes' `.env` doesn't match the
  one in the dashboard's `.env`. Re-copy and restart both.
- **Drafts never get a decision back** — `HERMES_API_URL` isn't set on the
  dashboard side, or Hermes' `/decision` endpoint isn't reachable from the
  dashboard server (firewall / DNS).
- **Dashboard goes quiet** — Mission Control accepts ingest writes silently;
  check Hermes' own logs for the `[dashboard] ... failed` lines from the
  helper above.
