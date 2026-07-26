import {
  pgTable,
  serial,
  varchar,
  integer,
  boolean,
  timestamp,
  check } from
"drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const monitorsTable = pgTable(
  "monitors",
  {
    id: serial("id").primaryKey(),
    url: varchar("url").notNull().unique(),
    name: varchar("name"),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    isActive: boolean("is_active").default(true),
    sslExpiryDate: timestamp("ssl_expiry_date"),
    createdAt: timestamp("created_at").defaultNow()
  },
  (table) => [
  check("interval_seconds_check", sql`${table.intervalSeconds} >= 30`)]

);

export const insertMonitorSchema = createInsertSchema(monitorsTable).omit({
  id: true,
  createdAt: true
});