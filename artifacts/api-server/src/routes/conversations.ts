import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  conversationsTable,
  conversationMembersTable,
  groupsTable,
  groupMembersTable,
  messagesTable,
  blocksTable,
} from "@workspace/db";
import { eq, and, inArray, desc, or } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { CreateOrGetDmBody } from "@workspace/api-zod";

const router = Router();

// GET /api/conversations
router.get("/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;

  // Get all conversations the user is a member of
  const memberships = await db
    .select()
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, userId));

  const conversationIds = memberships.map((m) => m.conversationId);
  if (conversationIds.length === 0) {
    res.json([]);
    return;
  }

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(inArray(conversationsTable.id, conversationIds));

  const result = await Promise.all(
    conversations.map(async (conv) => {
      // Get last message
      const [lastMessage] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      let lastMsg = null;
      if (lastMessage) {
        const [sender] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, lastMessage.senderId));
        lastMsg = {
          id: lastMessage.id,
          conversationId: lastMessage.conversationId,
          senderId: lastMessage.senderId,
          senderUsername: sender?.username ?? null,
          messageType: lastMessage.messageType,
          content: lastMessage.content ?? null,
          fileUrl: lastMessage.fileUrl ?? null,
          status: lastMessage.status,
          isDeletedForEveryone: lastMessage.isDeletedForEveryone,
          createdAt: lastMessage.createdAt.toISOString(),
        };
      }

      if (conv.type === "dm") {
        // Find the other member
        const others = await db
          .select()
          .from(conversationMembersTable)
          .where(
            and(
              eq(conversationMembersTable.conversationId, conv.id),
              // Use SQL not equal
            )
          );
        const otherMember = others.find((m) => m.userId !== userId);
        let otherUser = null;
        if (otherMember) {
          const [u] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, otherMember.userId));
          if (u) {
            otherUser = {
              id: u.id,
              username: u.username,
              profilePicUrl: u.profilePicUrl ?? null,
              aboutStatus: u.aboutStatus ?? null,
              onlineStatus: u.onlineStatus,
            };
          }
        }
        return {
          id: conv.id,
          type: "dm",
          otherUser,
          group: null,
          lastMessage: lastMsg,
          unreadCount: 0,
          createdAt: conv.createdAt.toISOString(),
        };
      } else {
        // group
        const [group] = await db
          .select()
          .from(groupsTable)
          .where(eq(groupsTable.conversationId, conv.id));
        const memberCount = await db
          .select()
          .from(groupMembersTable)
          .where(group ? eq(groupMembersTable.groupId, group.id) : eq(groupMembersTable.groupId, 0));

        return {
          id: conv.id,
          type: "group",
          otherUser: null,
          group: group
            ? {
                id: group.id,
                name: group.name,
                iconUrl: group.iconUrl ?? null,
                memberCount: memberCount.length,
              }
            : null,
          lastMessage: lastMsg,
          unreadCount: 0,
          createdAt: conv.createdAt.toISOString(),
        };
      }
    })
  );

  // Sort by last message createdAt desc
  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt;
    const bTime = b.lastMessage?.createdAt ?? b.createdAt;
    return bTime.localeCompare(aTime);
  });

  res.json(result);
});

// POST /api/conversations/dm
router.post("/conversations/dm", requireAuth, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = CreateOrGetDmBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { userId: targetUserId } = parsed.data;

  if (targetUserId === userId) {
    res.status(400).json({ error: "Cannot DM yourself" });
    return;
  }

  // Check if a DM already exists between these two users
  const myMemberships = await db
    .select()
    .from(conversationMembersTable)
    .where(eq(conversationMembersTable.userId, userId));
  const myConvIds = myMemberships.map((m) => m.conversationId);

  if (myConvIds.length > 0) {
    const theirMemberships = await db
      .select()
      .from(conversationMembersTable)
      .where(
        and(
          eq(conversationMembersTable.userId, targetUserId),
          inArray(conversationMembersTable.conversationId, myConvIds)
        )
      );

    for (const m of theirMemberships) {
      const [conv] = await db
        .select()
        .from(conversationsTable)
        .where(and(eq(conversationsTable.id, m.conversationId), eq(conversationsTable.type, "dm")));
      if (conv) {
        // Return existing DM
        const [targetUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, targetUserId));
        res.json({
          id: conv.id,
          type: "dm",
          otherUser: targetUser
            ? {
                id: targetUser.id,
                username: targetUser.username,
                profilePicUrl: targetUser.profilePicUrl ?? null,
                aboutStatus: targetUser.aboutStatus ?? null,
                onlineStatus: targetUser.onlineStatus,
              }
            : null,
          group: null,
          lastMessage: null,
          unreadCount: 0,
          createdAt: conv.createdAt.toISOString(),
        });
        return;
      }
    }
  }

  // Create new DM conversation
  const [conv] = await db
    .insert(conversationsTable)
    .values({ type: "dm" })
    .returning();

  await db.insert(conversationMembersTable).values([
    { conversationId: conv.id, userId },
    { conversationId: conv.id, userId: targetUserId },
  ]);

  const [targetUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId));

  res.json({
    id: conv.id,
    type: "dm",
    otherUser: targetUser
      ? {
          id: targetUser.id,
          username: targetUser.username,
          profilePicUrl: targetUser.profilePicUrl ?? null,
          aboutStatus: targetUser.aboutStatus ?? null,
          onlineStatus: targetUser.onlineStatus,
        }
      : null,
    group: null,
    lastMessage: null,
    unreadCount: 0,
    createdAt: conv.createdAt.toISOString(),
  });
});

export default router;
