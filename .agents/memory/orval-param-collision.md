---
name: Orval path+query param TS2308 collision
description: Endpoints with both path params AND query params cause a TS2308 export collision in api-zod
---

## The rule
When an OpenAPI endpoint has BOTH a path parameter (e.g. `{id}`) AND query parameters, Orval generates a TypeScript interface named `<OperationIdPascal>Params` in `generated/types/` AND a Zod schema of the same name in `generated/api.ts`. Both are re-exported by the barrel, causing:
```
error TS2308: Module "./generated/api" has already exported a member named 'ListMonitorLogsParams'
```

**Why:** Orval uses the combined path+query param shape to emit both a TypeScript interface (types/) and a Zod schema (api.ts) with the same name.

**How to apply:** If an endpoint needs both path params and query params, restructure it to use only query params (move the ID into `?monitorId=X`). This way Orval generates `ListMonitorLogsQueryParams` for the Zod schema and `ListMonitorLogsParams` for the TypeScript interface — different names, no collision.

Also: never name a component schema `<OperationIdPascal>Body` — use entity-shaped names (MonitorInput, not CreateMonitorBody).
