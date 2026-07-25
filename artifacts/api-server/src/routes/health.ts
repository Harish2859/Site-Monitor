import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res): Promise<void> => {
  let dbStatus = "ok";
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbStatus = "error";
  }

  res.json({ status: "ok", db: dbStatus });
});

export default router;
