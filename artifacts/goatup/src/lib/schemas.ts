import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  securityQuestion: z.string().min(1, "Security question is required"),
  securityAnswer: z.string().min(1, "Security answer is required"),
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(1, "Username is required"),
  method: z.enum(["question", "code"]),
  securityAnswer: z.string().optional(),
  recoveryCode: z.string().optional(),
}).refine(data => {
  if (data.method === "question" && !data.securityAnswer) return false;
  if (data.method === "code" && !data.recoveryCode) return false;
  return true;
}, {
  message: "Required field missing based on verification method",
  path: ["securityAnswer"],
});

export const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
});

export const forgotUsernameSchema = z.object({
  securityAnswer: z.string().min(1, "Security answer is required"),
});
