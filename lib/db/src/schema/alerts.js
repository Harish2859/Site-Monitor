import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  index } from
"drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { monitorsTable } from "./monitors";

export const alertsTable = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    monitorId: integer("monitor_id").references(() => monitorsTable.id, {
      onDelete: "cascade"
    }),
    eventType: varchar("event_type"),
    message: text("message"),
    resolved: boolean("resolved").default(false),
    triggeredAt: timestamp("triggered_at").defaultNow(),
    resolvedAt: timestamp("resolved_at")
  },
  (table) => [index("idx_alerts_monitor").on(table.monitorId, table.resolved)]
);

export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  triggeredAt: true
});