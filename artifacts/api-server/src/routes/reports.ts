import { Router } from "express";
import { db } from "@workspace/db";
import { reportsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { SubmitReportBody } from "@workspace/api-zod";

const router = Router();

// POST /api/reports
router.post("/reports", requireAuth, async (req, res): Promise<void> => {
  const body = SubmitReportBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await db.insert(reportsTable).values({
    reporterId: req.userId!,
    reportedUserId: body.data.reportedUserId ?? null,
    messageId: body.data.messageId ?? null,
    reason: body.data.reason,
  });

  res.status(201).json({ message: "Report submitted" });
});

export default router;
