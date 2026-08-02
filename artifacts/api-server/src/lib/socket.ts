import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyToken } from "./auth";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No token"));
    const payload = verifyToken(token);
    if (!payload) return next(new Error("Invalid token"));
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;
    next();
  });

  io.on("connection", async (socket) => {
    const userId: number = socket.data.userId;
    logger.info({ userId }, "Socket connected");

    // Join personal room and mark online
    await socket.join(`user:${userId}`);
    await db
      .update(usersTable)
      .set({ onlineStatus: true })
      .where(eq(usersTable.id, userId));
    io.emit("user:status", { userId, onlineStatus: true });

    socket.on("join:conversation", (conversationId: number) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("leave:conversation", (conversationId: number) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", ({ conversationId }: { conversationId: number }) => {
      socket.to(`conversation:${conversationId}`).emit("user:typing", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", ({ conversationId }: { conversationId: number }) => {
      socket.to(`conversation:${conversationId}`).emit("user:typing", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    socket.on("disconnect", async () => {
      logger.info({ userId }, "Socket disconnected");
      await db
        .update(usersTable)
        .set({ onlineStatus: false })
        .where(eq(usersTable.id, userId));
      io.emit("user:status", { userId, onlineStatus: false });
    });
  });

  return io;
}
