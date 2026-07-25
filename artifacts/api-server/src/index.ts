import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { createWsServer } from "./lib/ws-server";
import { startScheduler, stopScheduler } from "./lib/scheduler";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// Attach WebSocket server
createWsServer(server);

// Start HTTP server
server.listen(port, () => {
  logger.info({ port }, "Server listening");
  // Start the background polling scheduler
  startScheduler().catch((err) =>
    logger.error({ err }, "Failed to start scheduler"),
  );
});

server.on("error", (err) => {
  logger.error({ err }, "HTTP server error");
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Received shutdown signal, shutting down gracefully");
  stopScheduler();

  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error closing HTTP server");
    } else {
      logger.info("HTTP server closed");
    }
  });

  try {
    await pool.end();
    logger.info("DB pool closed");
  } catch (err) {
    logger.error({ err }, "Error closing DB pool");
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
