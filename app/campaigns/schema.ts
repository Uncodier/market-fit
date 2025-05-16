import { z } from "zod"

// Zod schema for campaign validation
export const campaignFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100, "Title must be at most 100 characters"),
  description: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]),
  type: z.string().min(1, "Campaign type is required"),
  dueDate: z.string().optional(),
  segments: z.array(z.string()).optional(),
  segmentObjects: z.array(
    z.object({
      id: z.string(),
      name: z.string()
    })
  ).optional(),
  requirements: z.array(z.string()).optional(),
  budget: z.object({
    allocated: z.number().min(0, "Budget cannot be negative"),
    remaining: z.number().optional(),
    currency: z.string().default("USD")
  }).optional(),
  revenue: z.object({
    actual: z.number().optional(),
    projected: z.number().optional(),
    estimated: z.number().optional(),
    currency: z.string().default("USD")
  }).optional(),
  site_id: z.string(),
  user_id: z.string()
})

export type CampaignFormValues = z.infer<typeof campaignFormSchema> 