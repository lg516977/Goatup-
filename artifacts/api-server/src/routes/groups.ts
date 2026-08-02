import { Router } from "express";
import { db } from "@workspace/db";
import {
  groupsTable,
  groupMembersTable,
  conversationsTable,
  conversationMembersTable,
  usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import {
  CreateGroupBody,
  GetGroupParams,
  UpdateGroupParams,
  UpdateGroupBody,
  AddGroupMemberParams,
  AddGroupMemberBody,
  RemoveGroupMemberParams,
  PromoteGroupMemberParams,
  LeaveGroupParams,
} from "@workspace/api-zod";

const router = Router();

function parseIntParam(val: string | string[]): number {
  const raw = Array.isArray(val) ? val[0] : val;
  return parseInt(raw, 10);
}

async function formatGroupDetail(groupId: number) {
  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId));
  if (!group) return null;

  const members = await db
    .select()
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, groupId));

  const memberDetails = await Promise.all(
    members.map(async (m) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, m.userId));
      return {
        userId: m.userId,
        username: user?.username ?? "Unknown",
        profilePicUrl: user?.profilePicUrl ?? null,
        isAdmin: m.isAdmin,
        joinedAt: m.joinedAt.toISOString(),
      };
    })
  );

  return {
    id: group.id,
    name: group.name,
    description: group.description ?? null,
    iconUrl: group.iconUrl ?? null,
    conversationId: group.conversationId,
    members: memberDetails,
    createdAt: group.createdAt.toISOString(),
  };
}

// POST /api/groups
router.post("/groups", requireAuth, async (req, res): Promise<void> => {
  const body = CreateGroupBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const { name, description, memberIds = [] } = body.data;

  // Create conversation
  const [conv] = await db
    .insert(conversationsTable)
    .values({ type: "group" })
    .returning();

  // Create group
  const [group] = await db
    .insert(groupsTable)
    .values({
      conversationId: conv.id,
      name,
      description: description ?? null,
    })
    .returning();

  // Add creator as admin
  await db.insert(groupMembersTable).values({
    groupId: group.id,
    userId: req.userId!,
    isAdmin: true,
  });

  // Add creator to conversation
  await db.insert(conversationMembersTable).values({
    conversationId: conv.id,
    userId: req.userId!,
  });

  // Add other members
  for (const memberId of memberIds) {
    if (memberId !== req.userId) {
      await db.insert(groupMembersTable).values({
        groupId: group.id,
        userId: memberId,
        isAdmin: false,
      });
      await db.insert(conversationMembersTable).values({
        conversationId: conv.id,
        userId: memberId,
      });
    }
  }

  const detail = await formatGroupDetail(group.id);
  res.status(201).json(detail);
});

// GET /api/groups/:groupId
router.get("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const params = GetGroupParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await formatGroupDetail(params.data.groupId);
  if (!detail) {
    res.status(404).json({ error: "Group not found" });
    return;
  }
  res.json(detail);
});

// PATCH /api/groups/:groupId
router.patch("/groups/:groupId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateGroupParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Check admin
  const [membership] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, group.id),
        eq(groupMembersTable.userId, req.userId!)
      )
    );
  if (!membership?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const body = UpdateGroupBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<typeof groupsTable.$inferInsert> = {};
  if (body.data.name != null) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description ?? undefined;
  if (body.data.iconUrl !== undefined) updates.iconUrl = body.data.iconUrl ?? undefined;

  await db.update(groupsTable).set(updates).where(eq(groupsTable.id, group.id));
  const detail = await formatGroupDetail(group.id);
  res.json(detail);
});

// POST /api/groups/:groupId/members
router.post("/groups/:groupId/members", requireAuth, async (req, res): Promise<void> => {
  const params = AddGroupMemberParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  // Check admin
  const [myMembership] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, group.id),
        eq(groupMembersTable.userId, req.userId!)
      )
    );
  if (!myMembership?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  const body = AddGroupMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  await db.insert(groupMembersTable).values({
    groupId: group.id,
    userId: body.data.userId,
    isAdmin: false,
  });
  await db.insert(conversationMembersTable).values({
    conversationId: group.conversationId,
    userId: body.data.userId,
  });

  res.json({ message: "Member added" });
});

// DELETE /api/groups/:groupId/members/:userId
router.delete("/groups/:groupId/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const params = RemoveGroupMemberParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
    userId: parseIntParam(req.params.userId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  const [myMembership] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, group.id),
        eq(groupMembersTable.userId, req.userId!)
      )
    );
  if (!myMembership?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, group.id),
        eq(groupMembersTable.userId, params.data.userId)
      )
    );
  await db
    .delete(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, group.conversationId),
        eq(conversationMembersTable.userId, params.data.userId)
      )
    );

  res.json({ message: "Member removed" });
});

// PATCH /api/groups/:groupId/members/:userId/promote
router.patch("/groups/:groupId/members/:userId/promote", requireAuth, async (req, res): Promise<void> => {
  const params = PromoteGroupMemberParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
    userId: parseIntParam(req.params.userId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [myMembership] = await db
    .select()
    .from(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, params.data.groupId),
        eq(groupMembersTable.userId, req.userId!)
      )
    );
  if (!myMembership?.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }

  await db
    .update(groupMembersTable)
    .set({ isAdmin: true })
    .where(
      and(
        eq(groupMembersTable.groupId, params.data.groupId),
        eq(groupMembersTable.userId, params.data.userId)
      )
    );

  res.json({ message: "Member promoted to admin" });
});

// POST /api/groups/:groupId/leave
router.post("/groups/:groupId/leave", requireAuth, async (req, res): Promise<void> => {
  const params = LeaveGroupParams.safeParse({
    groupId: parseIntParam(req.params.groupId),
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select()
    .from(groupsTable)
    .where(eq(groupsTable.id, params.data.groupId));
  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  await db
    .delete(groupMembersTable)
    .where(
      and(
        eq(groupMembersTable.groupId, group.id),
        eq(groupMembersTable.userId, req.userId!)
      )
    );
  await db
    .delete(conversationMembersTable)
    .where(
      and(
        eq(conversationMembersTable.conversationId, group.conversationId),
        eq(conversationMembersTable.userId, req.userId!)
      )
    );

  res.json({ message: "Left group" });
});

export default router;
