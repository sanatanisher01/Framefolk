import { z } from "zod";

export const postVisibilitySchema = z.enum([
  "public",
  "followers",
  "closeFriends",
  "private",
  "custom",
]);

export const createPostSchema = z.object({
  caption: z
    .string()
    .max(2200, "Caption must be under 2200 characters"),
  visibility: postVisibilitySchema,
  location: z
    .object({
      name: z.string().max(100),
      lat: z.number().optional(),
      lng: z.number().optional(),
    })
    .optional(),
  albumId: z.string().optional(),
  scheduledFor: z.date().optional(),
});

export type CreatePostFormValues = z.infer<typeof createPostSchema>;

export const commentSchema = z.object({
  text: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment must be under 500 characters")
    .trim(),
});

export type CommentFormValues = z.infer<typeof commentSchema>;
