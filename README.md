# Mission Control — First Word Read

A per-client AI Operations dashboard. **The dashboard is the source of truth.**
Hermes (the AI agent on the client's server) writes all events and drafts here via
a secure webhook API. Slack is used for notifications and approval shortcuts only.

---

## Architecture

```
[ Hermes ] ── POST /api/ingest/* ──▶ [ Dashboard (Next.js) ]
                                       │
                                       ├── stores in local SQLite (Prisma)
                                       ├── serves the real-time UI (Socket.io)
                                       ├── posts Slack notifications for drafts
                                       └── POSTs decisions back to Hermes
```

- **No external DB.** Everything lives in `data/db.sqlite`.
- **Slack is optional.** Dashboard works fully without it; just no Slack push.
- **One clone per client.** This repo is a git template — fork it for each new client.

---

## Quick start

```bash
# clone the repo into a fresh directory
git clone <this-repo> mission-control-darcy && cd mission-control-darcy

# one-command install (prompts for env, then `docker compose up`)
./scripts/install.sh
```

The installer prompts for client info, generates an `INGEST_API_KEY`, and brings
up app + nginx via Docker. When it finishes, it prints:

- the dashboard URL,
- the ingest endpoint Hermes should POST to,
- the `INGEST_API_KEY` to drop into Hermes' `.env`.

---

## Local development

```bash
cp .env.example .env
# Edit DASHBOARD_PASSWORD, INGEST_API_KEY, etc.
npm install
npx prisma migrate deploy
npm run seed         # optional — 30 days of demo data
npm run dev
```

Open <http://localhost:3000>. Sign in with `DASHBOARD_PASSWORD`.

---

## API

All ingest endpoints require `Authorization: Bearer ${INGEST_API_KEY}` and
return `202 Accepted` immediately (processing happens async).

| Endpoint | Body |
| --- | --- |
| `POST /api/ingest/event` | `{ agent_slug, action_type, description, metadata?, minutes_saved?, revenue_event? }` |
| `POST /api/ingest/draft` | `{ agent_slug, title, original_message, draft_text, priority, channel, metadata? }` |
| `POST /api/ingest/agent-comm` | `{ from_agent_slug, to_agent_slug, topic, question, answer }` |
| `POST /api/ingest/memory` | `{ memory_md_chars, user_md_chars }` |

Approval endpoints (require dashboard login):

| Endpoint | Body |
| --- | --- |
| `POST /api/approvals/:id/approve` | `{ edited_text? }` |
| `POST /api/approvals/:id/reject`  | `{ reason? }` |

Slack interactivity:

| Endpoint | Notes |
| --- | --- |
| `POST /api/slack/callback` | HMAC-verified via `SLACK_SIGNING_SECRET`; updates the original message in-place |

Read APIs (require dashboard login):

```
GET /api/agents
GET /api/activity?agent_slug=&action_type=&page=1&limit=100
GET /api/approvals?status=PENDING
GET /api/metrics/week
GET /api/metrics/sparklines
GET /api/comms
GET /api/memory
```

---

## Live dashboard updates

The custom `server.ts` runs Next + a Socket.io server on the same HTTP port
(`/socket.io/`). When an ingest endpoint writes a row, it calls
`globalThis.__ioEmit` to push the change to every connected dashboard within
~500 ms — no polling needed.

Events emitted to the `dashboard` room:

| Event | Payload |
| --- | --- |
| `event.new` | new activity entry |
| `draft.new` | new pending draft (kanban "Needs Attention" updates) |
| `draft.update` | status changed (APPROVED / REJECTED / SENT) |
| `comm.new` | inter-agent comm logged |
| `agent.update` | agent status changed |
| `memory.update` | MEMORY.MD snapshot received |

---

## Connecting Hermes

See [`docs/hermes_integration_patch.md`](docs/hermes_integration_patch.md) for
the exact changes to Hermes' system prompt and skill files needed to wire
Hermes up to the dashboard's ingest API.

---

## Deployment

`docker compose up -d --build` builds the Next.js app and runs it behind nginx
on port 80. SQLite lives in the host's `./data` directory (mounted into the
container at `/app/data`) so it survives upgrades.

To put HTTPS in front, terminate TLS on a reverse proxy (Cloudflare Tunnel,
Caddy, Traefik, or extend `nginx.conf` with a TLS server block).

---

## File map

```
mission-control/
├── prisma/schema.prisma          – Agents / Events / Drafts / Comms / Memory
├── server.ts                     – Next.js + Socket.io custom server
├── src/
│   ├── app/
│   │   ├── dashboard/            – Mission board, Activity, Approvals, Agents, Metrics
│   │   ├── login/                – Single-password auth
│   │   └── api/                  – Ingest, approvals, slack callback, queries
│   ├── components/               – Header / Board / Feed / Footer / Comms panel …
│   └── lib/                      – db, agents, slack, hermes, metrics, auth
├── scripts/
│   ├── install.sh                – Interactive installer
│   └── seed.ts                   – 30 days of demo data
├── docs/hermes_integration_patch.md
├── docker-compose.yml
├── Dockerfile
└── nginx.conf
```

Powered by **First Word Read**.
