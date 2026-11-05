import { z } from "zod";
import { USERNAME_REGEX, RESERVED_USERNAMES } from "@/utils/validators";

export const editProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be under 60 characters")
    .trim(),
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
  bio: z
    .string()
    .max(200, "Bio must be under 200 characters"),
  website: z
    .string()
    .max(200)
    .refine(
      (v) => v === "" || /^https?:\/\/.+/.test(v),
      "Please enter a valid URL starting with http:// or https://"
    ),
  location: z
    .string()
    .max(60, "Location must be under 60 characters"),
  pronouns: z
    .string()
    .max(30, "Pronouns must be under 30 characters"),
  isPrivate: z.boolean(),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;

export const cloudinaryConnectionSchema = z.object({
  cloudName: z
    .string()
    .min(3, "Cloud name must be at least 3 characters")
    .max(50, "Cloud name is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Cloud name can only contain lowercase letters, numbers and hyphens"
    ),
  apiKey: z
    .string()
    .min(10, "API Key appears too short")
    .max(100, "API Key is too long")
    .regex(/^\d+$/, "API Key should be numeric"),
  apiSecret: z
    .string()
    .min(10, "API Secret appears too short")
    .max(200, "API Secret is too long"),
});

export type CloudinaryConnectionFormValues = z.infer<
  typeof cloudinaryConnectionSchema
>;
