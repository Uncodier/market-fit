import { z } from "zod"

export const categorySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(50, "Name must be at most 50 characters"),
  description: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  site_id: z.string().uuid(),
  user_id: z.string().uuid()
})

export type CategoryFormData = z.infer<typeof categorySchema>

export const taskCategorySchema = z.object({
  task_id: z.string().uuid(),
  category_id: z.string().uuid()
})

export type TaskCategoryData = z.infer<typeof taskCategorySchema> 