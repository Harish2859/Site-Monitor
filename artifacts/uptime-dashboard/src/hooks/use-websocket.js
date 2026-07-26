import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListMonitorsQueryKey, getListAlertsQueryKey, getListMonitorLogsQueryKey } from '@workspace/api-client-react';

import { toast } from 'sonner';





export function useMonitorWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef();
  const batchUpdatesRef = useRef(new Map());
  const batchTimerRef = useRef(null);

  useEffect(() => {
    function connect() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'check_result') {
            // Add to batch
            batchUpdatesRef.current.set(data.monitor.id, data.monitor);

            // Invalidate logs for this monitor individually (react-query handles deduping these)
            queryClient.invalidateQueries({ queryKey: getListMonitorLogsQueryKey({ monitorId: data.monitor.id }) });

            if (!batchTimerRef.current) {
              batchTimerRef.current = setTimeout(() => {
                const updates = Array.from(batchUpdatesRef.current.values());
                batchUpdatesRef.current.clear();
                batchTimerRef.current = null;

                // Apply all batched updates at once
                queryClient.setQueryData(
                  getListMonitorsQueryKey(),
                  (old) => {
                    if (!old) return old;
                    return old.map((m) => {
                      const update = updates.find((u) => u.id === m.id);
                      return update ? { ...m, ...update } : m;
                    });
                  }
                );
              }, 250);
            }
          } else if (data.type === 'alert') {
            const { eventType, message } = data.alert;

            // Show toast
            if (eventType === 'DOWN') {
              toast.error(`Monitor Down`, { description: message });
            } else if (eventType === 'RECOVERED') {
              toast.success(`Monitor Recovered`, { description: message });
            } else if (eventType === 'HIGH_LATENCY') {
              toast.warning(`High Latency`, { description: message });
            }

            // Invalidate alerts to fetch the fresh list
            queryClient.invalidateQueries({ queryKey: getListAlertsQueryKey() });
          }
        } catch (err) {
          console.error('Failed to parse WS message', err);
        }
      };

      ws.onclose = () => {
        // Reconnect after 3s
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);
}