import { z } from "zod";
import { USERNAME_REGEX, RESERVED_USERNAMES } from "@/utils/validators";

// ─────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────

export const registerSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be under 60 characters")
    .trim(),
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export const loginSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email("Please enter a valid email address")
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// ─────────────────────────────────────────────
// PASSWORD RESET
// ─────────────────────────────────────────────

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

// ─────────────────────────────────────────────
// USERNAME SELECTION (onboarding step)
// ─────────────────────────────────────────────

export const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be under 30 characters")
    .regex(
      USERNAME_REGEX,
      "Username can only contain letters, numbers, periods and underscores"
    )
    .toLowerCase()
    .trim()
    .refine(
      (val) => !RESERVED_USERNAMES.has(val.toLowerCase()),
      "This username is not available"
    ),
});

export type UsernameFormValues = z.infer<typeof usernameSchema>;

// ─────────────────────────────────────────────
// ONBOARDING PROFILE STEP
// ─────────────────────────────────────────────

export const onboardingProfileSchema = z.object({
  bio: z
    .string()
    .max(200, "Bio must be under 200 characters"),
});

export type OnboardingProfileFormValues = z.infer<typeof onboardingProfileSchema>;
