import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversationsTable } from "./conversations";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  messageType: text("message_type").notNull().default("text"), // "text" | "image" | "voice"
  content: text("content"),
  fileUrl: text("file_url"),
  status: text("status").notNull().default("sent"), // "sent" | "delivered" | "read"
  isDeletedForEveryone: boolean("is_deleted_for_everyone")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messageDeletionsTable = pgTable("message_deletions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id")
    .notNull()
    .references(() => messagesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;

export const insertMessageDeletionSchema = createInsertSchema(
  messageDeletionsTable
).omit({ id: true, deletedAt: true });
export type InsertMessageDeletion = z.infer<
  typeof insertMessageDeletionSchema
>;
export type MessageDeletion = typeof messageDeletionsTable.$inferSelect;
