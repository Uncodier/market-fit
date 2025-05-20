import { z } from "zod"

export const taskCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  categoryId: z.string(),
  dueDate: z.date().optional(),
  assignedTo: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type TaskCategory = z.infer<typeof taskCategorySchema>
export type Task = z.infer<typeof taskSchema> 