export type RelationTargetConfig = {
  table: string
  selectFields: string
  nameField: string
  idField: string
}

const TARGET_CONFIG: Record<string, RelationTargetConfig> = {
  lead: { table: "leads", selectFields: "id, name, company", nameField: "name", idField: "id" },
  company: { table: "companies", selectFields: "id, name", nameField: "name", idField: "id" },
  sales_order: { table: "sale_orders", selectFields: "id, order_number", nameField: "order_number", idField: "id" },
  deal: { table: "deals", selectFields: "id, name", nameField: "name", idField: "id" },
  supplier: { table: "suppliers", selectFields: "id, name", nameField: "name", idField: "id" },
  team_member: {
    table: "site_members",
    selectFields: "user_id, name, email",
    nameField: "name",
    idField: "user_id",
  },
  campaign: { table: "campaigns", selectFields: "id, title", nameField: "title", idField: "id" },
  catalog_item: { table: "catalog_items", selectFields: "id, name", nameField: "name", idField: "id" },
  content: { table: "content", selectFields: "id, title", nameField: "title", idField: "id" },
  task: { table: "tasks", selectFields: "id, title", nameField: "title", idField: "id" },
  sale: { table: "sales", selectFields: "id, title", nameField: "title", idField: "id" },
  purchase: { table: "purchases", selectFields: "id, title", nameField: "title", idField: "id" },
  quotation: { table: "quotations", selectFields: "id, title", nameField: "title", idField: "id" },
  record: { table: "records", selectFields: "id, title", nameField: "title", idField: "id" },
  record_category: { table: "record_categories", selectFields: "id, name", nameField: "name", idField: "id" },
}

export function getRelationTargetConfig(target: string): RelationTargetConfig | null {
  return Object.prototype.hasOwnProperty.call(TARGET_CONFIG, target) ? TARGET_CONFIG[target] : null
}

export type RelationFieldTarget = { type?: string; relationTarget?: string; targetCategoryId?: string }

export function relationFieldTargetKey(field: RelationFieldTarget): string {
  const target = field.relationTarget || "lead"
  return target === "record" && field.targetCategoryId ? `record:${field.targetCategoryId}` : target
}

export function parseRelationTargetKey(key: string): { target: string; categoryId?: string } {
  if (!key.startsWith("record:")) return { target: key }
  const categoryId = key.slice(7)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryId)) {
    throw new Error("Invalid record category")
  }
  return { target: "record", categoryId }
}

export function uniqueRelationTargets(fields: RelationFieldTarget[]): string[] {
  const targets = new Set<string>()
  for (const field of fields) {
    if (field.type === "relation") targets.add(relationFieldTargetKey(field))
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
    if (selectedIds.has(option.id) && !next.has(option.id)) next.set(option.id, option)
  }
  return Array.from(next.values())
}
