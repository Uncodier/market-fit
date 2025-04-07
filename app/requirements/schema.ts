import * as z from "zod"

export const requirementFormSchema = z.object({
  title: z.string()
    .min(3, { message: "El título debe tener al menos 3 caracteres" })
    .max(120, { message: "El título no puede exceder los 120 caracteres" }),
  description: z.string()
    .min(10, { message: "La descripción debe tener al menos 10 caracteres" })
    .max(500, { message: "La descripción no puede exceder los 500 caracteres" }),
  priority: z.enum(["high", "medium", "low"], {
    required_error: "Por favor selecciona una prioridad",
  }),
  status: z.enum(["validated", "in-progress", "on-review", "done", "backlog", "canceled"], {
    required_error: "Por favor selecciona un estado",
  }),
  completionStatus: z.enum(["pending", "completed", "rejected"], {
    required_error: "Por favor selecciona un estado de finalización",
  }),
  source: z.string({
    required_error: "Por favor selecciona una fuente",
  }),
  budget: z.coerce.number()
    .min(0, { message: "El presupuesto no puede ser negativo" })
    .optional()
    .nullable(),
  segments: z.array(z.string()).min(1, {
    message: "Por favor selecciona al menos un segmento",
  }),
  campaigns: z.array(z.string()).optional().default([]),
  user_id: z.string(),
  site_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type RequirementFormValues = z.infer<typeof requirementFormSchema> 