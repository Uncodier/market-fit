import { z } from "zod"

// Esquema para URLs de recursos
export const resourceUrlSchema = z.object({
  key: z.string().min(1, "El nombre del recurso es requerido"),
  url: z.string().url("La URL debe ser válida")
})

// Esquema para competidores
export const competitorSchema = z.object({
  url: z.string().url("La URL debe ser válida").or(z.string().length(0))
})

// Esquema para el formulario de sitio
export const siteFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  url: z.string().url("La URL debe ser válida").or(z.string().length(0)),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  blogUrl: z.string().url("La URL del blog debe ser válida").or(z.string().length(0)),
  competitors: z.array(competitorSchema),
  focusMode: z.number().min(0).max(100),
  resource_urls: z.array(resourceUrlSchema)
})

// Tipos inferidos de los esquemas
export type SiteFormValues = z.infer<typeof siteFormSchema>
export type ResourceUrl = z.infer<typeof resourceUrlSchema>
export type Competitor = z.infer<typeof competitorSchema> 