import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../lib/auth";
import {
  RegisterBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ForgotUsernameBody,
  GetMeResponse,
  RegisterResponse,
  LoginResponse,
} from "@workspace/api-zod";

const router = Router();

// POST /api/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password, securityQuestion, securityAnswer } = parsed.data;

  // Validate password strength
  const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
  if (!strongPassword) {
    res.status(400).json({
      error: "Password must have at least 8 chars, 1 uppercase, 1 number, 1 special character",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (existing) {
    res.status(409).json({ error: "This username is already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const answerHash = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);
  const recoveryCode = crypto.randomBytes(16).toString("hex").toUpperCase();
  const recoveryCodeHash = await bcrypt.hash(recoveryCode, 10);

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      passwordHash,
      securityQuestion,
      securityAnswerHash: answerHash,
      recoveryCodeHash,
    })
    .returning();

  const token = signToken({ userId: user.id, username: user.username });
  res.status(201).json(
    RegisterResponse.parse({
      token,
      recoveryCode,
      user: {
        id: user.id,
        username: user.username,
        profilePicUrl: user.profilePicUrl ?? null,
        aboutStatus: user.aboutStatus ?? null,
        onlineStatus: user.onlineStatus,
        lastSeenVisibility: user.lastSeenVisibility,
        createdAt: user.createdAt.toISOString(),
      },
    })
  );
});

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  res.json(
    LoginResponse.parse({
      token,
      recoveryCode: null,
      user: {
        id: user.id,
        username: user.username,
        profilePicUrl: user.profilePicUrl ?? null,
        aboutStatus: user.aboutStatus ?? null,
        onlineStatus: user.onlineStatus,
        lastSeenVisibility: user.lastSeenVisibility,
        createdAt: user.createdAt.toISOString(),
      },
    })
  );
});

// POST /api/auth/logout
router.post("/auth/logout", requireAuth, async (_req, res): Promise<void> => {
  res.json({ message: "Logged out" });
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json(
    GetMeResponse.parse({
      id: user.id,
      username: user.username,
      profilePicUrl: user.profilePicUrl ?? null,
      aboutStatus: user.aboutStatus ?? null,
      onlineStatus: user.onlineStatus,
      lastSeenVisibility: user.lastSeenVisibility,
      createdAt: user.createdAt.toISOString(),
    })
  );
});

// POST /api/auth/forgot-password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { username, securityAnswer, recoveryCode } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }

  let verified = false;
  if (securityAnswer) {
    verified = await bcrypt.compare(securityAnswer.toLowerCase().trim(), user.securityAnswerHash);
  } else if (recoveryCode && user.recoveryCodeHash) {
    verified = await bcrypt.compare(recoveryCode, user.recoveryCodeHash);
  }

  if (!verified) {
    res.status(400).json({ error: "Verification failed" });
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await db
    .update(usersTable)
    .set({ resetToken, resetTokenExpiresAt: expiresAt })
    .where(eq(usersTable.id, user.id));

  res.json({ resetToken });
});

// POST /api/auth/reset-password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { resetToken, newPassword } = parsed.data;

  const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword);
  if (!strongPassword) {
    res.status(400).json({
      error: "Password must have at least 8 chars, 1 uppercase, 1 number, 1 special character",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.resetToken, resetToken));
  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(usersTable)
    .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password reset successfully" });
});

// POST /api/auth/forgot-username
router.post("/auth/forgot-username", async (req, res): Promise<void> => {
  const parsed = ForgotUsernameBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { securityAnswer } = parsed.data;

  // We need to check all users — this is a simplified implementation
  // In production, you'd want the user to also provide a hint
  const users = await db.select().from(usersTable);
  for (const user of users) {
    const match = await bcrypt.compare(
      securityAnswer.toLowerCase().trim(),
      user.securityAnswerHash
    );
    if (match) {
      res.json({ username: user.username });
      return;
    }
  }
  res.status(400).json({ error: "No account found with that security answer" });
});

export default router;
