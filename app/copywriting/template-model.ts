import { z } from "zod"

export const copyTemplateKind = z.enum(["newsletter", "whatsapp"])
export type CopyTemplateKind = z.infer<typeof copyTemplateKind>
export const WHATSAPP_TEMPLATE_TAG = "whatsapp-template"

export const copyTemplateSchema = z.object({
  kind: copyTemplateKind,
  title: z.string().trim().min(1).max(193).regex(/^[^\r\n\u0000]+$/),
  body: z.string().trim().min(1).max(20_000),
}).strict().refine(value => value.kind !== "whatsapp" || value.body.length <= 1024)

export type CopyTemplateDraft = z.infer<typeof copyTemplateSchema>

export const copyTestSchema = z.object({
  copy_id: z.string().uuid(),
  lead_id: z.string().uuid(),
  draft: copyTemplateSchema,
}).strict().refine(value => !/\{\{|\}\}/.test(`${value.draft.title}\n${value.draft.body}`) &&
  (value.draft.kind !== "whatsapp" || value.draft.body.length <= 1017))