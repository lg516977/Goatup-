import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  GetUserParams,
  UpdateProfileBody,
  SearchUsersQueryParams,
} from "@workspace/api-zod";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    profilePicUrl: user.profilePicUrl ?? null,
    aboutStatus: user.aboutStatus ?? null,
    onlineStatus: user.onlineStatus,
    lastSeenVisibility: user.lastSeenVisibility,
    createdAt: user.createdAt.toISOString(),
  };
}

function formatUserSummary(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    profilePicUrl: user.profilePicUrl ?? null,
    aboutStatus: user.aboutStatus ?? null,
    onlineStatus: user.onlineStatus,
  };
}

// GET /api/users/search?q=
router.get("/users/search", requireAuth, async (req, res): Promise<void> => {
  const parsed = SearchUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { q } = parsed.data;
  const users = await db
    .select()
    .from(usersTable)
    .where(ilike(usersTable.username, `%${q}%`))
    .limit(20);

  res.json(users.filter((u) => u.id !== req.userId).map(formatUserSummary));
});

// GET /api/users/:userId
router.get("/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse({
    userId: parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId, 10),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(formatUserSummary(user));
});

// PATCH /api/users/me/profile
router.patch("/users/me/profile", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (parsed.data.aboutStatus !== undefined) updates.aboutStatus = parsed.data.aboutStatus ?? undefined;
  if (parsed.data.profilePicUrl !== undefined) updates.profilePicUrl = parsed.data.profilePicUrl ?? undefined;
  if (parsed.data.lastSeenVisibility !== undefined) updates.lastSeenVisibility = parsed.data.lastSeenVisibility;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

export default router;
