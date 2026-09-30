import { z } from "zod"

// Shared public DTO. Never expose original content, provider output or command metadata.
export const contentGenerationResultSchema = z.object({
  success: z.literal(true),
  data: z.object({
    status: z.literal("completed"),
    contentId: z.string().uuid(),
    siteId: z.string().uuid(),
    saved_to_database: z.literal(true),
    edited_content: z.object({
      title: z.string().min(1).max(1_000),
      description: z.string().max(20_000).nullable(),
      text: z.string().max(200_000).refine((value) => value.trim().length > 0),
    }),
  }),
})

export const CONTENT_GENERATION_UNCONFIRMED =
  "Content generation could not be confirmed. Reload the content before trying again."