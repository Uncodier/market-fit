import * as z from "zod"

export const experimentFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  hypothesis: z.string().min(1, "La hipótesis es requerida"),
  segments: z.array(z.string()).min(1, "Debe seleccionar al menos un segmento"),
  campaign_id: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "completed"]).default("draft"),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  conversion: z.number().nullable(),
  roi: z.number().nullable(),
  preview_url: z.string().optional().nullable(),
  user_id: z.string().min(1, "El usuario es requerido"),
  site_id: z.string().min(1, "El sitio es requerido"),
  created_at: z.string(),
  updated_at: z.string(),
})

export type ExperimentFormValues = z.infer<typeof experimentFormSchema> 