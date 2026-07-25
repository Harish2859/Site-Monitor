# Signal — Website Uptime & Performance Monitor

A production-grade full-stack uptime monitoring dashboard. Add URLs to monitor, and Signal checks them on your chosen interval, tracks response time history, detects anomalies, and streams live status updates to the dashboard via WebSocket.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, also serves WebSocket at /ws)
- `pnpm --filter @workspace/uptime-dashboard run dev` — run the frontend dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark-mode Datadog/Vercel aesthetic)
- API: Express 5 + WebSocket (ws package)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Charts: Recharts
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (monitors, monitor_logs, alerts)
- `artifacts/api-server/src/lib/scheduler.ts` — the core polling engine
- `artifacts/api-server/src/lib/ssrf.ts` — SSRF protection (DNS resolution + IP range blocking)
- `artifacts/api-server/src/lib/ws-server.ts` — WebSocket server + broadcast helper
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/uptime-dashboard/src/` — React frontend

## Architecture decisions

- **Single scheduler tick (5s)** with `Promise.allSettled` + `p-limit(20)` for concurrent outbound checks — no per-monitor setInterval
- **In-flight Set** prevents overlapping checks for the same monitor
- **SSRF protection**: DNS-resolves all hostnames and blocks private IP ranges before any outbound fetch
- **WebSocket at /ws**: attached to the same HTTP server via `noServer` mode; the API server artifact.toml exposes `/ws` as a path so the reverse proxy forwards WebSocket upgrades
- **Anomaly detection**: transition-based DOWN/RECOVERED alerts (not repeated on every tick); HIGH_LATENCY fires when response > 2× rolling 10-check average AND > 1000ms
- **Alerts route** uses raw pg pool for parameterized WHERE clause building (Drizzle's sql template can't mix with dynamic conditions the same way)

## Product

- Dashboard: 4 summary stat cards + live monitor grid with colored status badges, uptime %, response time
- Monitor detail: Recharts response-time area chart (last 100 checks) + status history table
- Alerts panel: filterable by resolved/unresolved, shows monitor name and event type
- Add-monitor modal: URL, optional name, interval selector (30s–1h)
- Real-time: WebSocket streams check results and alerts; frontend batches log updates (200ms debounce), shows status/alert changes immediately

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run `pnpm --filter @workspace/api-spec run codegen` before touching routes
- Drizzle's `sql` template + dynamic `eq()` conditions don't mix in `db.execute()` — use the raw `pool.query()` for dynamic WHERE clauses
- The `/ws` path must be listed in `artifacts/api-server/.replit-artifact/artifact.toml` paths array or the reverse proxy won't forward WebSocket upgrades
- OpenAPI body schema names must NOT match `<OperationIdPascal>Body` pattern — use entity-shaped names (MonitorInput, not CreateMonitorBody) to avoid TS2308 collisions
- Endpoints with BOTH path params AND query params cause Orval to generate a `<OperationIdPascal>Params` name in both api.ts AND generated/types/, causing TS2308 — restructure to use only query params if needed

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
