import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { monitorsTable } from "./monitors";

export const monitorLogsTable = pgTable(
  "monitor_logs",
  {
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id").references(() => monitorsTable.id, {
      onDelete: "cascade",
    }),
    statusCode: integer("status_code"),
    responseTimeMs: integer("response_time_ms"),
    status: varchar("status"),
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at").defaultNow(),
  },
  (table) => [
    index("idx_logs_monitor_time").on(table.monitorId, table.checkedAt),
  ],
);

export const insertMonitorLogSchema = createInsertSchema(monitorLogsTable).omit(
  { id: true, checkedAt: true },
);
export type InsertMonitorLog = z.infer<typeof insertMonitorLogSchema>;
export type MonitorLog = typeof monitorLogsTable.$inferSelect;
