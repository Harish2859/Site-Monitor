import { performance } from "perf_hooks";
import pLimit from "p-limit";
import { sql, eq, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { monitorsTable, monitorLogsTable, alertsTable } from "@workspace/db";

import { validateUrl, SsrfError } from "./ssrf";
import { broadcast } from "./ws-server";
import { logger } from "./logger";

const TICK_MS = 5_000;
const FETCH_TIMEOUT_MS = 10_000;
const CONCURRENCY_LIMIT = 20;
const ROLLING_WINDOW = 10;

// In-memory state
const lastCheckedAt = new Map();
const inFlight = new Set();
const monitorStatus = new Map();
const rollingResponseTimes = new Map();

let tickInterval = null;
const limiter = pLimit(CONCURRENCY_LIMIT);

// Initialize state from DB (load latest status per monitor on startup)
async function initState() {
  try {
    const rows = await db.execute(



      sql`
      SELECT DISTINCT ON (monitor_id) monitor_id, status, checked_at
      FROM monitor_logs
      ORDER BY monitor_id, checked_at DESC
    `);

    for (const row of rows.rows) {
      if (row.status === "UP" || row.status === "DOWN") {
        monitorStatus.set(row.monitor_id, row.status);
      }
      if (row.checked_at) {
        lastCheckedAt.set(row.monitor_id, new Date(row.checked_at));
      }
    }
    logger.info({ count: rows.rows.length }, "Scheduler: loaded initial monitor state");
  } catch (err) {
    logger.error({ err }, "Scheduler: failed to load initial state");
  }
}

async function checkMonitor(monitor) {
  if (inFlight.has(monitor.id)) return;
  inFlight.add(monitor.id);

  const startTime = performance.now();
  let statusCode = null;
  let responseTimeMs = null;
  let status = "DOWN";
  let errorMessage = null;

  try {
    // SSRF protection
    await validateUrl(monitor.url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(monitor.url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "UptimeMonitor/1.0" }
      });
      clearTimeout(timeout);

      responseTimeMs = Math.round(performance.now() - startTime);
      statusCode = response.status;
      status = response.status >= 200 && response.status < 300 ? "UP" : "DOWN";
    } catch (fetchErr) {
      clearTimeout(timeout);
      responseTimeMs = Math.round(performance.now() - startTime);
      errorMessage =
      fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
      if (errorMessage.includes("aborted") || errorMessage.includes("abort")) {
        errorMessage = "Request timed out after 10 seconds";
      }
      status = "DOWN";
    }
  } catch (err) {
    responseTimeMs = Math.round(performance.now() - startTime);
    if (err instanceof SsrfError) {
      errorMessage = `SSRF blocked: ${err.message}`;
    } else {
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    status = "DOWN";
  }

  // Update last checked time
  const checkedAt = new Date();
  lastCheckedAt.set(monitor.id, checkedAt);

  // Insert log
  let logId = null;
  try {
    const [log] = await db.
    insert(monitorLogsTable).
    values({ monitorId: monitor.id, statusCode, responseTimeMs, status, errorMessage }).
    returning({ id: monitorLogsTable.id });
    logId = log?.id ?? null;
  } catch (err) {
    logger.error({ err, monitorId: monitor.id }, "Scheduler: failed to insert log");
  }

  // Update rolling response times (for HIGH_LATENCY detection)
  if (responseTimeMs !== null && status === "UP") {
    const times = rollingResponseTimes.get(monitor.id) ?? [];
    times.push(responseTimeMs);
    if (times.length > ROLLING_WINDOW) times.shift();
    rollingResponseTimes.set(monitor.id, times);
  }

  // Anomaly detection
  const prevStatus = monitorStatus.get(monitor.id);
  const alerts =



  [];

  if (status === "DOWN" && prevStatus !== "DOWN") {
    // Transition to DOWN
    try {
      const [alert] = await db.
      insert(alertsTable).
      values({
        monitorId: monitor.id,
        eventType: "DOWN",
        message: errorMessage ?
        `Monitor is DOWN: ${errorMessage}` :
        `Monitor is DOWN (HTTP ${statusCode ?? "no response"})`,
        resolved: false
      }).
      returning({ id: alertsTable.id });
      alerts.push({ eventType: "DOWN", message: `${monitor.url} is DOWN`, id: alert?.id });
    } catch (err) {
      logger.error({ err, monitorId: monitor.id }, "Scheduler: failed to insert DOWN alert");
    }
  } else if (status === "UP" && prevStatus === "DOWN") {
    // RECOVERED
    try {
      // Mark existing DOWN alerts as resolved
      await db.
      update(alertsTable).
      set({ resolved: true, resolvedAt: new Date() }).
      where(
        and(
          eq(alertsTable.monitorId, monitor.id),
          eq(alertsTable.eventType, "DOWN"),
          eq(alertsTable.resolved, false)
        )
      );

      const [alert] = await db.
      insert(alertsTable).
      values({
        monitorId: monitor.id,
        eventType: "RECOVERED",
        message: `Monitor recovered after being DOWN`,
        resolved: false
      }).
      returning({ id: alertsTable.id });
      alerts.push({ eventType: "RECOVERED", message: `${monitor.url} has RECOVERED`, id: alert?.id });
    } catch (err) {
      logger.error({ err, monitorId: monitor.id }, "Scheduler: failed to insert RECOVERED alert");
    }
  }

  // HIGH_LATENCY check
  if (status === "UP" && responseTimeMs !== null && responseTimeMs > 1000) {
    const times = rollingResponseTimes.get(monitor.id) ?? [];
    if (times.length >= 2) {
      const rollingAvg = times.slice(0, -1).reduce((a, b) => a + b, 0) / (times.length - 1);
      if (responseTimeMs > rollingAvg * 2) {
        try {
          await db.insert(alertsTable).values({
            monitorId: monitor.id,
            eventType: "HIGH_LATENCY",
            message: `High latency detected: ${responseTimeMs}ms (rolling avg: ${Math.round(rollingAvg)}ms)`,
            resolved: false
          });
          alerts.push({
            eventType: "HIGH_LATENCY",
            message: `${monitor.url} HIGH_LATENCY: ${responseTimeMs}ms`
          });
        } catch (err) {
          logger.error({ err, monitorId: monitor.id }, "Scheduler: failed to insert HIGH_LATENCY alert");
        }
      }
    }
  }

  // Update in-memory status
  monitorStatus.set(monitor.id, status);

  // Compute uptime for broadcast
  let uptimePercent = null;
  try {
    const uptimeRow = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'UP') as up_count, COUNT(*) as total_count
      FROM (
        SELECT status FROM monitor_logs
        WHERE monitor_id = ${monitor.id}
        ORDER BY checked_at DESC
        LIMIT 100
      ) sub
    `);
    const row = uptimeRow.rows[0];
    if (row && Number(row.total_count) > 0) {
      uptimePercent = Math.round(Number(row.up_count) / Number(row.total_count) * 10000) / 100;
    }
  } catch {

    // non-critical
  }
  // Broadcast check result
  broadcast({
    type: "check_result",
    monitor: {
      id: monitor.id,
      url: monitor.url,
      name: monitor.name ?? null,
      intervalSeconds: monitor.intervalSeconds,
      isActive: monitor.isActive ?? true,
      currentStatus: status,
      lastResponseTimeMs: responseTimeMs,
      lastCheckedAt: checkedAt.toISOString(),
      uptimePercent
    }
  });

  // Broadcast each alert
  for (const alert of alerts) {
    broadcast({ type: "alert", alert: { ...alert, monitorId: monitor.id } });
  }

  inFlight.delete(monitor.id);
}

async function tick() {
  let monitors = [];
  try {
    monitors = await db.
    select().
    from(monitorsTable).
    where(eq(monitorsTable.isActive, true));
  } catch (err) {
    logger.error({ err }, "Scheduler: failed to fetch monitors");
    return;
  }

  const now = Date.now();
  const due = monitors.filter((m) => {
    if (inFlight.has(m.id)) return false;
    const last = lastCheckedAt.get(m.id);
    if (!last) return true;
    return now - last.getTime() >= m.intervalSeconds * 1000;
  });

  if (due.length === 0) return;

  logger.debug({ count: due.length }, "Scheduler: dispatching checks");

  const tasks = due.map((m) => limiter(() => checkMonitor(m).catch((err) => {
    logger.error({ err, monitorId: m.id }, "Scheduler: unhandled error in checkMonitor");
  })));

  await Promise.allSettled(tasks);
}

export async function startScheduler() {
  await initState();
  tickInterval = setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Scheduler: tick error"));
  }, TICK_MS);
  // Run immediately on start
  tick().catch((err) => logger.error({ err }, "Scheduler: initial tick error"));
  logger.info({ tickMs: TICK_MS }, "Scheduler started");
}

export function stopScheduler() {
  if (tickInterval !== null) {
    clearInterval(tickInterval);
    tickInterval = null;
    logger.info("Scheduler stopped");
  }
}