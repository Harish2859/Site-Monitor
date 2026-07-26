import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pool } from "@workspace/db";
import { monitorsTable } from "@workspace/db";
import {
  CreateMonitorBody,
  DeleteMonitorParams,
} from "@workspace/api-zod";
import { validateUrl, SsrfError } from "../lib/ssrf";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /monitors — list all with latest status + uptime %
router.get("/monitors", async (req, res): Promise<void> => {
  const monitors = await db.select().from(monitorsTable);

  if (monitors.length === 0) {
    res.json([]);
    return;
  }

  const monitorIds = monitors.map((m) => m.id);

  // Latest log per monitor (pool.query — pg driver serialises JS array correctly for ANY($1::int[]))
  const latestLogs = await pool.query<{
    monitor_id: number;
    status: string | null;
    response_time_ms: number | null;
    checked_at: Date | null;
  }>(
    `SELECT DISTINCT ON (monitor_id) monitor_id, status, response_time_ms, checked_at
     FROM monitor_logs
     WHERE monitor_id = ANY($1::int[])
     ORDER BY monitor_id, checked_at DESC`,
    [monitorIds],
  );

  // Uptime % from last 100 logs per monitor
  const uptimeRows = await pool.query<{
    monitor_id: number;
    up_count: string;
    total_count: string;
  }>(
    `SELECT monitor_id,
            COUNT(*) FILTER (WHERE status = 'UP') AS up_count,
            COUNT(*) AS total_count
     FROM (
       SELECT monitor_id, status,
              ROW_NUMBER() OVER (PARTITION BY monitor_id ORDER BY checked_at DESC) AS rn
       FROM monitor_logs
       WHERE monitor_id = ANY($1::int[])
     ) sub
     WHERE rn <= 100
     GROUP BY monitor_id`,
    [monitorIds],
  );

  const latestMap = new Map(latestLogs.rows.map((r) => [r.monitor_id, r]));
  const uptimeMap = new Map(uptimeRows.rows.map((r) => [r.monitor_id, r]));

  const result = monitors.map((m) => {
    const latest = latestMap.get(m.id);
    const uptime = uptimeMap.get(m.id);
    const uptimePercent =
      uptime && Number(uptime.total_count) > 0
        ? (Number(uptime.up_count) / Number(uptime.total_count)) * 100
        : null;
    return {
      id: m.id,
      url: m.url,
      name: m.name ?? null,
      intervalSeconds: m.intervalSeconds,
      isActive: m.isActive ?? true,
      sslExpiryDate: m.sslExpiryDate ? m.sslExpiryDate.toISOString() : null,
      createdAt: m.createdAt ? m.createdAt.toISOString() : new Date().toISOString(),
      currentStatus: latest?.status ?? null,
      lastResponseTimeMs: latest?.response_time_ms ?? null,
      lastCheckedAt: latest?.checked_at ? new Date(latest.checked_at).toISOString() : null,
      uptimePercent: uptimePercent !== null ? Math.round(uptimePercent * 100) / 100 : null,
    };
  });

  res.json(result);
});

// POST /monitors — create a monitor
router.post("/monitors", async (req, res): Promise<void> => {
  const parsed = CreateMonitorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, name, intervalSeconds = 60 } = parsed.data;

  if (intervalSeconds < 30) {
    res.status(400).json({ error: "interval_seconds must be at least 30" });
    return;
  }

  // SSRF protection + URL validation
  try {
    await validateUrl(url);
  } catch (err) {
    if (err instanceof SsrfError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Unexpected error validating URL");
    res.status(400).json({ error: "URL validation failed" });
    return;
  }

  try {
    const [monitor] = await db
      .insert(monitorsTable)
      .values({ url, name: name ?? null, intervalSeconds })
      .returning();

    res.status(201).json({
      id: monitor.id,
      url: monitor.url,
      name: monitor.name ?? null,
      intervalSeconds: monitor.intervalSeconds,
      isActive: monitor.isActive ?? true,
      sslExpiryDate: monitor.sslExpiryDate ? monitor.sslExpiryDate.toISOString() : null,
      createdAt: monitor.createdAt ? monitor.createdAt.toISOString() : new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("unique")) {
      res.status(400).json({ error: "A monitor for this URL already exists" });
      return;
    }
    throw err;
  }
});

// DELETE /monitors/:id
router.delete("/monitors/:id", async (req, res): Promise<void> => {
  const params = DeleteMonitorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(monitorsTable)
    .where(eq(monitorsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Monitor not found" });
    return;
  }

  logger.info({ monitorId: params.data.id }, "Monitor deleted");
  res.sendStatus(204);
});

export default router;
