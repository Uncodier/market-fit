export type RelationTargetConfig = {
  table: string
  selectFields: string
  nameField: string
}

const TARGET_CONFIG: Record<string, RelationTargetConfig> = {
  lead: { table: "leads", selectFields: "id, name, company", nameField: "name" },
  company: { table: "companies", selectFields: "id, name", nameField: "name" },
  sales_order: { table: "orders", selectFields: "id, order_number", nameField: "order_number" },
  deal: { table: "deals", selectFields: "id, title", nameField: "title" },
  person: { table: "users", selectFields: "id, name, email", nameField: "name" },
  campaign: { table: "campaigns", selectFields: "id, title", nameField: "title" },
  catalog_item: { table: "products", selectFields: "id, name", nameField: "name" },
  content: { table: "content", selectFields: "id, title", nameField: "title" },
  task: { table: "tasks", selectFields: "id, title", nameField: "title" },
  sale: { table: "sales", selectFields: "id, title", nameField: "title" },
  purchase: { table: "purchases", selectFields: "id, title", nameField: "title" },
  quotation: { table: "quotations", selectFields: "id, title", nameField: "title" },
  record: { table: "records", selectFields: "id, title", nameField: "title" },
  record_category: { table: "record_categories", selectFields: "id, name", nameField: "name" },
}

export function getRelationTargetConfig(target: string): RelationTargetConfig {
  return TARGET_CONFIG[target] || { table: target, selectFields: "id", nameField: "name" }
}

export function uniqueRelationTargets(fields: Array<{ type?: string; relationTarget?: string }>): string[] {
  const targets = new Set<string>()
  for (const field of fields) {
    if (field.type === "relation") {
      targets.add(field.relationTarget || "lead")
    }
  }
  return Array.from(targets)
}

export function relationOptionSearchText(item: Record<string, unknown>, nameField: string): string {
  const label = item[nameField]
  const extras = Object.entries(item)
    .filter(([key, value]) => key !== "id" && key !== nameField && typeof value === "string")
    .map(([, value]) => value)
  return [label, ...extras].filter(Boolean).join(" ")
}

export function keepSelectedRelationOptions<T extends { id: string }>(
  incoming: T[],
  previous: T[],
  selectedIds: Set<string>,
): T[] {
  const next = new Map(incoming.map((option) => [option.id, option]))
  for (const option of previous) {
    if (selectedIds.has(option.id) && !next.has(option.id)) {
      next.set(option.id, option)
    }
  }
  return Array.from(next.values())
}
