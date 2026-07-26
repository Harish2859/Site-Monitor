# Signal 📡

**Signal is a real-time uptime monitor that watches your websites and alerts you the moment something breaks.**

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)

---

## Overview

When a website goes down, every second of downtime costs real money and erodes user trust — but most teams don't find out until a customer reports it. Signal continuously polls your endpoints on a configurable schedule, detects failures and latency spikes the moment they occur, and pushes live status updates to every connected browser over WebSocket — no manual refresh, no polling from the client side.

It's built for developers and small teams who need production-grade uptime visibility without the complexity of a SaaS monitoring platform.

---

## ✨ Key Features

- **Add any URL to monitor** — paste a URL, give it an optional name, and choose a check interval (minimum 30 seconds)
- **Live dashboard** — monitor cards update in real time as checks complete, showing current status, response time, and uptime percentage
- **Instant alerts** — DOWN, RECOVERED, and HIGH_LATENCY events appear as toast notifications the moment they're detected, with no page refresh required
- **Uptime history** — each monitor's detail page shows a response-time chart and a full log of every check result
- **Alerts panel** — a dedicated page lists all events with their type, message, timestamp, and resolution status
- **Security-first URL submission** — private IP addresses and internal hostnames are blocked server-side before the first request is ever made

---

## 🏗 Architecture / How It Works

### Polling Engine

A central scheduler runs on a **5-second tick**. On each tick it queries the database for all active monitors, identifies which ones are due (based on their configured `interval_seconds` and last check time), and dispatches their checks concurrently through a `p-limit(20)` concurrency limiter. Monitors that haven't responded yet (tracked in an in-flight `Set`) are skipped automatically, so a slow external server can never cause a backlog or double-fire.

Each check uses Node's `AbortController` with a **10-second hard timeout**, measures wall-clock response time with `performance.now()`, records the HTTP status code and error message, and writes a log row to PostgreSQL.

### Real-Time Updates

After every check completes, the scheduler calls `broadcast()` — which iterates over all connected WebSocket clients and sends a `check_result` JSON message. The frontend receives this message and applies the monitor update directly into TanStack Query's cache, triggering a re-render of exactly the affected monitor card — no HTTP re-fetch, no full list reload.

On the frontend, `check_result` messages are **batched over a 250ms window**: rapid-fire updates for different monitors accumulate in a `Map`, then the entire batch is committed to the cache in a single `setQueryData` call, keeping re-renders minimal.

Alert messages (`DOWN`, `RECOVERED`, `HIGH_LATENCY`) are sent immediately (not batched) and also trigger a cache invalidation so the Alerts page stays current.

### Anomaly & Alert Detection

The scheduler tracks each monitor's previous status in memory:

| Transition | Event |
|---|---|
| Any → DOWN | `DOWN` alert inserted; existing unresolved DOWN alerts remain open |
| DOWN → UP | All open DOWN alerts marked resolved; `RECOVERED` alert inserted |
| UP (slow) | `HIGH_LATENCY` alert if response > 1 000ms **and** > 2× the rolling average of the previous 10 successful checks |

### SSRF Protection

User-submitted URLs are a Server-Side Request Forgery risk: without validation, an attacker can submit `http://169.254.169.254/latest/meta-data/` or `http://10.0.0.1/admin` and make the server fetch internal resources on their behalf.

Signal's `validateUrl()` function runs before every fetch — both when a monitor is created and on every polling tick:

1. Parses and verifies the URL uses `http` or `https`
2. Blocks `localhost`, `127.0.0.1`, and `::1` by hostname
3. DNS-resolves the hostname (`dns.resolve` with `dns.lookup` fallback)
4. Checks every returned IP against blocked ranges: loopback (`127.x`), private class A/B/C (`10.x`, `172.16–31.x`, `192.168.x`), link-local (`169.254.x`), and IPv6 loopback/ULA prefixes

Any violation throws an `SsrfError` and returns a 400 to the caller.

### Architecture Diagram

```mermaid
flowchart LR
    subgraph Browser
        UI[React Dashboard]
        WS_CLIENT[WebSocket Client]
    end

    subgraph Backend ["Express API Server (Node.js)"]
        API[REST Routes]
        WS_SERVER[WebSocket Server /ws]
        SCHEDULER[Polling Scheduler\n5s tick · p-limit 20]
        SSRF[SSRF Validator]
    end

    DB[(PostgreSQL)]
    EXTERNAL[External URLs]

    UI -- HTTP REST --> API
    UI -- WS upgrade --> WS_SERVER
    API -- read/write --> DB
    SCHEDULER -- INSERT logs/alerts --> DB
    SCHEDULER -- broadcast --> WS_SERVER
    WS_SERVER -- push updates --> WS_CLIENT
    SCHEDULER -- fetch via SSRF --> SSRF
    SSRF -- DNS resolved & safe --> EXTERNAL
```

---

## 🛠 Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend framework | React 19 + Vite | Fast HMR during development; RSC-ready when needed |
| UI components | shadcn/ui + Tailwind CSS v4 | Accessible primitives with no runtime overhead |
| Data fetching | TanStack Query v5 | Stale-while-revalidate cache; WebSocket writes directly into it |
| Charts | Recharts | Lightweight composable charts with minimal bundle impact |
| Real-time transport | WebSocket (`ws`) | Server-push without client-side polling overhead |
| API server | Express + TypeScript | Minimal, well-understood HTTP server; easy to keep thin |
| ORM / query builder | Drizzle ORM | Type-safe schema-first; raw `pool.query()` where Drizzle's parameterization falls short |
| Database | PostgreSQL | Reliable, index-friendly for time-series log queries |
| Schema migrations | Drizzle Kit | `drizzle-kit push` keeps dev schema in sync without a migration file backlog |
| Concurrency limiter | p-limit | Caps simultaneous outbound fetches at 20 without blocking the event loop |
| Monorepo tooling | pnpm workspaces | Shared `lib/db` and `lib/api-spec` packages across frontend and backend |
| API contract | OpenAPI 3.1 + Orval | Generates typed React Query hooks from the spec; single source of truth |
| Validation | Zod | Runtime validation of all request bodies and query params |
| Logging | pino + pino-http | Structured JSON logs with per-request IDs; negligible overhead |

---

## 🔧 Engineering Challenges Solved

### 1. Concurrent Polling Without Blocking the Event Loop

A naïve implementation would set one `setInterval` per monitor. That means 100 monitors = 100 independent timers, each potentially running a slow DNS lookup and HTTP fetch at the same moment, saturating Node's outbound connection pool.

Signal uses a **single 5-second master tick** that wakes up, queries the DB for all active monitors, filters to those that are due, and dispatches them through `p-limit(20)`. The limiter ensures at most 20 outbound fetches run concurrently regardless of how many monitors are configured. `Promise.allSettled` is used (not `Promise.all`) so a single failed check never aborts the rest of the batch.

### 2. In-Flight Overlap Protection

If an external server is slow (say, responds in 8 seconds) and the check interval is 5 seconds, a naïve scheduler would fire a second check before the first one finishes — creating duplicate logs and potentially misleading DOWN transitions.

Signal maintains an `inFlight: Set<number>` of monitor IDs currently being checked. The very first thing `checkMonitor()` does is test membership and return early if the monitor is already in flight. The ID is removed only after the log is written and alerts are processed, guaranteeing exactly one concurrent check per monitor.

### 3. SSRF Prevention on User-Submitted URLs

Every URL a user adds is potentially a vector for Server-Side Request Forgery. Signal addresses this at two levels:

- **On creation** (`POST /api/monitors`): `validateUrl()` runs before the row is inserted
- **On every poll**: `validateUrl()` runs again before the fetch — defending against DNS rebinding attacks where a hostname resolves to a public IP at creation time and a private IP at check time

The DNS check resolves all returned addresses (not just the first) and blocks any that fall in RFC-1918, loopback, or link-local space.

### 4. PostgreSQL Array-Parameter Binding Bug in Drizzle's `sql` Template

**The symptom:** `GET /api/monitors` returned 500 on every request. Server logs showed:

```
Error: Failed query:
  SELECT DISTINCT ON (monitor_id) ...
  WHERE monitor_id = ANY(($1)::int[])
params: 1
```

**The diagnosis:** Drizzle's `sql` tagged template binds interpolated JavaScript values as individual `$N` positional parameters. When you write `sql\`... ANY(${monitorIds}::int[])\``, Drizzle correctly emits `$1` for the array, but it sends the JS array as a scalar value. PostgreSQL receives a JSON-style string for `$1` and cannot implicitly cast it to `int[]` — the `::int[]` cast is part of the SQL text, not a type hint to the driver.

**The fix:** Switch both queries (`latestLogs` and `uptimeRows`) to `pool.query(text, params)` from the raw `pg` pool. The `pg` driver natively serializes a JS `number[]` as a PostgreSQL array literal when passed as a bind parameter, making `ANY($1::int[])` work correctly:

```ts
// ❌ Fails: Drizzle sql template binds array as scalar
await db.execute(sql`WHERE monitor_id = ANY(${monitorIds}::int[])`);

// ✅ Works: pg driver serialises JS array correctly
await pool.query(`WHERE monitor_id = ANY($1::int[])`, [monitorIds]);
```

This is consistent with how the alerts route was already written and is now documented as a project convention.

### 5. Batched WebSocket Updates on the Frontend

The scheduler can fire check results for multiple monitors in rapid succession (e.g. 10 monitors all due at the same 5-second tick). Without batching, each `check_result` message would call `setQueryData` and trigger a React re-render — 10 messages = 10 re-renders in milliseconds.

Signal's `useMonitorWebSocket` hook accumulates `check_result` payloads in a `Map<id, MonitorWithStatus>` and commits the entire batch to TanStack Query's cache in a single `setQueryData` call after a 250ms debounce window. `alert` messages bypass the batch (they're immediate) since they also show a toast notification.

---

## 🗄 Database Schema

### `monitors`
Stores each configured endpoint. `url` is unique (one monitor per URL). A `CHECK` constraint enforces `interval_seconds >= 30` at the database level.

```sql
monitors (
  id               SERIAL PRIMARY KEY,
  url              VARCHAR NOT NULL UNIQUE,
  name             VARCHAR,
  interval_seconds INTEGER NOT NULL DEFAULT 60,
  is_active        BOOLEAN DEFAULT true,
  ssl_expiry_date  TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
)
```

### `monitor_logs`
One row per check execution. Indexed on `(monitor_id, checked_at DESC)` for efficient "latest N logs per monitor" queries. Cascades on monitor delete.

```sql
monitor_logs (
  id               SERIAL PRIMARY KEY,
  monitor_id       INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
  status_code      INTEGER,
  response_time_ms INTEGER,
  status           VARCHAR,        -- 'UP' | 'DOWN'
  error_message    TEXT,
  checked_at       TIMESTAMP DEFAULT NOW(),

  INDEX idx_logs_monitor_time (monitor_id, checked_at)
)
```

### `alerts`
One row per anomaly event. `resolved` is set to `true` and `resolved_at` is stamped when a monitor recovers. Indexed on `(monitor_id, resolved)` for efficient unresolved-alert queries.

```sql
alerts (
  id           SERIAL PRIMARY KEY,
  monitor_id   INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
  event_type   VARCHAR,       -- 'DOWN' | 'RECOVERED' | 'HIGH_LATENCY'
  message      TEXT,
  resolved     BOOLEAN DEFAULT false,
  triggered_at TIMESTAMP DEFAULT NOW(),
  resolved_at  TIMESTAMP,

  INDEX idx_alerts_monitor (monitor_id, resolved)
)
```

---

## 📡 API Reference

All routes are prefixed with `/api` by the reverse proxy. The WebSocket endpoint is at `/ws`.

| Method | Path | Description | Request / Response |
|---|---|---|---|
| `GET` | `/healthz` | Health check | `{ status: "ok", db: "ok" \| "error" }` |
| `GET` | `/api/monitors` | List all monitors with current status & uptime | `Monitor[]` — includes `currentStatus`, `lastResponseTimeMs`, `uptimePercent` |
| `POST` | `/api/monitors` | Create a monitor | Body: `{ url, name?, intervalSeconds? }` → `201 Monitor` or `400` |
| `DELETE` | `/api/monitors/:id` | Delete a monitor (cascades logs & alerts) | `204` or `404` |
| `GET` | `/api/monitor-logs` | Paginated check history for one monitor | Query: `monitorId` (required), `limit` (max 500), `before` (ISO cursor) → `{ logs: Log[], hasMore: boolean }` |
| `GET` | `/api/alerts` | List alerts with optional filters | Query: `resolved?`, `limit?`, `monitorId?` → `Alert[]` with joined monitor URL/name |
| `WS` | `/ws` | Real-time event stream | Server pushes `check_result` and `alert` messages |

**WebSocket message shapes:**

```ts
// Server → Client
{ type: "connected" }
{ type: "check_result"; monitor: MonitorWithStatus }
{ type: "alert"; alert: { id?: number; eventType: string; message: string; monitorId: number } }
```

---

## 🚀 Getting Started / Local Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 15+ (local or remote)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd signal
pnpm install
```

### 2. Configure environment variables

Create `artifacts/api-server/.env` (never commit this file):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/signal_dev
SESSION_SECRET=replace-with-a-long-random-string
NODE_ENV=development
PORT=8080
```

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run db:push
```

This runs `drizzle-kit push` and applies all table definitions directly to your database. No migration files required for development.

### 4. Start the services

In two separate terminals:

```bash
# Terminal 1 — API server (build + start)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (Vite dev server)
pnpm --filter @workspace/uptime-dashboard run dev
```

The dashboard will be available at `http://localhost:<PORT>` (the port Vite prints on startup). The API server listens on `http://localhost:8080` by default.

### 5. Add your first monitor

Click the **+** button in the bottom-right corner of the dashboard, enter a URL (e.g. `https://example.com`), and hit **Add Monitor**. The polling engine will pick it up on the next 5-second tick.

---

## 📸 Screenshots

<!-- TODO: Replace these placeholders with real screenshots once the app is deployed -->

**Dashboard overview — live monitor grid with status cards**
![Dashboard overview showing monitor grid with UP/DOWN status, response time, and uptime percentage](./screenshots/dashboard-overview.png)

**Monitor detail — response time chart and check history log**
![Monitor detail page with Recharts area chart of response times and paginated log table](./screenshots/monitor-detail.png)

**Add monitor modal — URL input, name, and interval selector**
![Add monitor modal with URL field, optional name field, and interval dropdown](./screenshots/add-monitor-modal.png)

**Alerts panel — DOWN, RECOVERED, and HIGH_LATENCY events**
![Alerts page listing anomaly events with event type, message, and resolution status](./screenshots/alerts-panel.png)

---

## 🔭 Future Improvements

The current build is a solid foundation, but a production-grade monitoring service would also need:

- **Authentication & multi-tenancy** — currently there's no auth layer; all monitors are global. Adding Clerk or a session-based auth system would be the first step toward a multi-user product.
- **Alert delivery** — DOWN events are shown in the UI but not yet delivered externally. Email (via Resend or SendGrid), Slack webhooks, and PagerDuty integrations are the obvious next additions.
- **Longer uptime history** — uptime percentage is currently calculated over the last 100 checks per monitor. A time-series rollup table (hourly/daily aggregates) would support 30/90-day uptime SLA reporting without scanning millions of log rows.
- **SSL certificate expiry monitoring** — the schema already has an `ssl_expiry_date` column; the polling engine could be extended to inspect TLS certificates and alert before they expire.
- **Incident timeline** — grouping related DOWN → RECOVERED events into a single "incident" record would make it easier to understand MTTR and historical reliability.
- **Status page** — a public-facing, read-only status page (no auth required) showing aggregate uptime and recent incidents, similar to statuspage.io.
- **Configurable alert thresholds** — HIGH_LATENCY detection currently uses a fixed 1 000ms baseline and a 2× multiplier against the rolling average; per-monitor configurable thresholds would be more flexible.

---

## 📄 License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
