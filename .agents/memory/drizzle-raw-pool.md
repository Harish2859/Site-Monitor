---
name: Drizzle dynamic WHERE — use pool.query()
description: Dynamic parameterized WHERE clauses must use pool.query(), not db.execute() with sql template
---

## The rule
When building a dynamic WHERE clause (conditions array based on optional query params), use the raw pg `pool` directly:

```typescript
import { pool } from "@workspace/db";
const params: unknown[] = [];
const conditions: string[] = [];
if (someFilter !== undefined) {
  params.push(someFilter);
  conditions.push(`a.column = $${params.length}`);
}
params.push(limit);
const result = await pool.query(queryText, params);
```

**Why:** `db.execute(sql\`...\`)` with Drizzle's `eq()` / `and()` helpers mixed into a template literal doesn't work — Drizzle's query builder and raw sql tagged templates don't compose for dynamic conditions. `sql.raw(query, params)` is also not a valid Drizzle API. The raw `pool.query(text, params)` is the right escape hatch.

**How to apply:** Use for any route that needs a dynamic WHERE clause built from optional request params.
