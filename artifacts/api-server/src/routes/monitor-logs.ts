import { Router, type IRouter } from "express";
import { eq, and, lt } from "drizzle-orm";
import { db } from "@workspace/db";
import { monitorsTable, monitorLogsTable } from "@workspace/db";
import { ListMonitorLogsQueryParams } from "@workspace/api-zod";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /monitor-logs?monitorId=X&limit=N&before=T
router.get("/monitor-logs", async (req, res): Promise<void> => {
  const parsed = ListMonitorLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { monitorId, limit = 100, before } = parsed.data;
  const safeLimit = Math.min(limit, 500);

  // Check monitor exists
  const [monitor] = await db
    .select({ id: monitorsTable.id })
    .from(monitorsTable)
    .where(eq(monitorsTable.id, monitorId));

  if (!monitor) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }

  const conditions = [eq(monitorLogsTable.monitorId, monitorId)];
  if (before) {
    conditions.push(lt(monitorLogsTable.checkedAt, new Date(before)));
  }

  // Fetch one extra to determine hasMore
  const logs = await db
    .select()
    .from(monitorLogsTable)
    .where(and(...conditions))
    .orderBy(desc(monitorLogsTable.checkedAt))
    .limit(safeLimit + 1);

  const hasMore = logs.length > safeLimit;
  const page = hasMore ? logs.slice(0, safeLimit) : logs;

  res.json({
    logs: page.map((l) => ({
      id: l.id,
      monitorId: l.monitorId,
      statusCode: l.statusCode ?? null,
      responseTimeMs: l.responseTimeMs ?? null,
      status: l.status ?? null,
      errorMessage: l.errorMessage ?? null,
      checkedAt: l.checkedAt ? l.checkedAt.toISOString() : new Date().toISOString(),
    })),
    hasMore,
  });
});

export default router;
