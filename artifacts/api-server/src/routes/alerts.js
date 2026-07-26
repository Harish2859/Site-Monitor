import { Router } from "express";
import { pool } from "@workspace/db";
import { ListAlertsQueryParams } from "@workspace/api-zod";

const router = Router();

// GET /alerts?resolved=false&limit=50&monitorId=X
router.get("/alerts", async (req, res) => {
  const parsed = ListAlertsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { resolved, limit, monitorId } = parsed.data;
  const safeLimit = Math.min(limit ?? 50, 200);

  const conditions = [];
  const params = [];

  if (resolved !== undefined && resolved !== null) {
    params.push(resolved);
    conditions.push(`a.resolved = $${params.length}`);
  }
  if (monitorId !== undefined && monitorId !== null) {
    params.push(monitorId);
    conditions.push(`a.monitor_id = $${params.length}`);
  }

  params.push(safeLimit);
  const limitParam = `$${params.length}`;

  const whereClause =
  conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const queryText = `
    SELECT 
      a.id, a.monitor_id, a.event_type, a.message, a.resolved, 
      a.triggered_at, a.resolved_at,
      m.url as monitor_url, m.name as monitor_name
    FROM alerts a
    LEFT JOIN monitors m ON m.id = a.monitor_id
    ${whereClause}
    ORDER BY a.triggered_at DESC
    LIMIT ${limitParam}
  `;

  const result = await pool.query(queryText, params);

  res.json(
    result.rows.map(
      (r) => (









      {
        id: r.id,
        monitorId: r.monitor_id,
        eventType: r.event_type ?? null,
        message: r.message ?? null,
        resolved: r.resolved,
        triggeredAt: r.triggered_at ?
        new Date(r.triggered_at).toISOString() :
        new Date().toISOString(),
        resolvedAt: r.resolved_at ?
        new Date(r.resolved_at).toISOString() :
        null,
        monitorUrl: r.monitor_url ?? null,
        monitorName: r.monitor_name ?? null
      })
    )
  );
});

export default router;