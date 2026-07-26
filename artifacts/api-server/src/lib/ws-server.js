import { WebSocketServer, WebSocket } from "ws";

import { logger } from "./logger";

let wss = null;

export function createWsServer(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = request.url ?? "";
    if (url.startsWith("/ws")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    ws.on("error", (err) => logger.error({ err }, "WebSocket client error"));
    ws.send(JSON.stringify({ type: "connected" }));
  });

  logger.info("WebSocket server initialized");
  return wss;
}

export function broadcast(data) {
  if (!wss) return;
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(msg);
      } catch (err) {
        logger.warn({ err }, "Failed to send WebSocket message to client");
      }
    }
  }
}