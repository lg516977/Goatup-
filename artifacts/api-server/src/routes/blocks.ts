import { Router } from "express";
import { db } from "@workspace/db";
import { blocksTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { BlockUserBody, UnblockUserParams } from "@workspace/api-zod";

const router = Router();

// GET /api/blocks
router.get("/blocks", requireAuth, async (req, res): Promise<void> => {
  const blocks = await db
    .select()
    .from(blocksTable)
    .where(eq(blocksTable.blockerId, req.userId!));

  const users = await Promise.all(
    blocks.map(async (b) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, b.blockedId));
      return user
        ? {
            id: user.id,
            username: user.username,
            profilePicUrl: user.profilePicUrl ?? null,
            aboutStatus: user.aboutStatus ?? null,
            onlineStatus: user.onlineStatus,
          }
        : null;
    })
  );

  res.json(users.filter(Boolean));
});

// POST /api/blocks
router.post("/blocks", requireAuth, async (req, res): Promise<void> => {
  const body = BlockUserBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { userId: blockedId } = body.data;
  if (blockedId === req.userId) {
    res.status(400).json({ error: "Cannot block yourself" });
    return;
  }

  // Check if already blocked
  const [existing] = await db
    .select()
    .from(blocksTable)
    .where(
      and(
        eq(blocksTable.blockerId, req.userId!),
        eq(blocksTable.blockedId, blockedId)
      )
    );
  if (existing) {
    res.json({ message: "Already blocked" });
    return;
  }

  await db.insert(blocksTable).values({
    blockerId: req.userId!,
    blockedId,
  });

  res.json({ message: "User blocked" });
});

// DELETE /api/blocks/:userId
router.delete("/blocks/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = UnblockUserParams.safeParse({
    userId: parseInt(
      Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId,
      10
    ),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .delete(blocksTable)
    .where(
      and(
        eq(blocksTable.blockerId, req.userId!),
        eq(blocksTable.blockedId, params.data.userId)
      )
    );

  res.json({ message: "User unblocked" });
});

export default router;
