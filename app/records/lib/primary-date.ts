type TemplateField = { id: string; type: string; name: string }

export function primaryDateField<T extends TemplateField>(fields: readonly T[], id?: string | null) {
  return id ? fields.find(field => field?.id === id && field.type === "date") : undefined
}