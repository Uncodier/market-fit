export type EmbedSpec = {
  alias: string
  table: string
  hint?: string
  inner: boolean
  nested: EmbedSpec[]
}

const KNOWN_TABLES = new Set([
  "catalog_items",
  "catalog_categories",
  "record_categories",
  "records",
  "leads",
  "sales",
  "sale_orders",
  "sale_order_items",
  "shipments",
  "locations",
  "price_lists",
  "promotions",
  "campaigns",
  "reservations",
  "subscriptions",
  "taxes",
  "quotation_items",
  "quotations",
  "profiles",
  "messages",
])

function singularize(name: string): string {
  if (name.endsWith("ies")) return `${name.slice(0, -3)}y`
  if (name.endsWith("s") && !name.endsWith("ss")) return name.slice(0, -1)
  return name
}

function parseEmbedToken(token: string, body: string): EmbedSpec {
  let inner = false
  let hint: string | undefined
  const bang = token.split("!")
  const left = bang[0]
  const right = bang[1]
  if (right === "inner") inner = true
  else if (right) hint = right

  let alias: string
  let table: string
  if (left.includes(":")) {
    const [a, t] = left.split(":")
    alias = a
    table = t
  } else {
    alias = left
    table = left
  }

  if (table.endsWith("_id") && !KNOWN_TABLES.has(table)) {
    hint = table
    table = ""
  }

  return { alias, table, hint, inner, nested: parseSelectEmbeds(body) }
}

export function parseSelectEmbeds(select: string): EmbedSpec[] {
  const embeds: EmbedSpec[] = []
  let i = 0
  const s = select || ""

  while (i < s.length) {
    while (i < s.length && /[\s,*]/.test(s[i])) i++
    if (i >= s.length) break

    const start = i
    while (i < s.length && !/[\s(]/.test(s[i])) i++
    const token = s.slice(start, i).trim()
    if (!token) break

    while (i < s.length && /\s/.test(s[i])) i++
    if (s[i] !== "(") continue

    i += 1
    const bodyStart = i
    let depth = 1
    while (i < s.length && depth > 0) {
      if (s[i] === "(") depth += 1
      else if (s[i] === ")") depth -= 1
      if (depth > 0) i += 1
      else break
    }
    const body = s.slice(bodyStart, i)
    if (s[i] === ")") i += 1
    embeds.push(parseEmbedToken(token, body))
  }

  return embeds
}

function pickFk(
  row: Record<string, unknown>,
  spec: EmbedSpec,
  sourceTable: string
): { kind: "belongsTo" | "hasMany"; column: string } {
  if (spec.hint && Object.prototype.hasOwnProperty.call(row, spec.hint)) {
    return { kind: "belongsTo", column: spec.hint }
  }

  const candidates = [`${spec.alias}_id`, `${singularize(spec.table || spec.alias)}_id`]
  for (const column of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, column)) {
      return { kind: "belongsTo", column }
    }
  }

  return { kind: "hasMany", column: `${singularize(sourceTable)}_id` }
}

function attachEmbed(
  row: Record<string, any>,
  sourceTable: string,
  spec: EmbedSpec,
  memoryData: Record<string, any[]>
): any {
  const table = spec.table || sourceTable
  const related = memoryData[table] || []
  const fk = pickFk(row, spec, sourceTable)

  if (fk.kind === "belongsTo") {
    const match = related.find((item) => item.id === row[fk.column]) || null
    const resolved = match
      ? attachEmbeds(match, table, spec.nested, memoryData)
      : null
    return { ...row, [spec.alias]: resolved }
  }

  const children = related
    .filter((item) => item[fk.column] === row.id)
    .map((item) => attachEmbeds(item, table, spec.nested, memoryData))
  return { ...row, [spec.alias]: children }
}

function attachEmbeds(
  row: Record<string, any>,
  sourceTable: string,
  embeds: EmbedSpec[],
  memoryData: Record<string, any[]>
): any {
  return embeds.reduce(
    (current, spec) => attachEmbed(current, sourceTable, spec, memoryData),
    row
  )
}

export function applySelectEmbeds(
  rows: any[],
  sourceTable: string,
  select: string | undefined,
  memoryData: Record<string, any[]>
): any[] {
  if (!select || typeof select !== "string") return rows
  const embeds = parseSelectEmbeds(select)
  if (embeds.length === 0) return rows

  const enriched = rows.map((row) => attachEmbeds(row, sourceTable, embeds, memoryData))
  const innerEmbeds = embeds.filter((embed) => embed.inner)
  if (innerEmbeds.length === 0) return enriched

  return enriched.filter((row) =>
    innerEmbeds.every((embed) => {
      const value = row[embed.alias]
      return value != null && !(Array.isArray(value) && value.length === 0)
    })
  )
}

export function applyNotFilter(
  rows: any[],
  column: string,
  operator: string,
  value: any
): any[] {
  const op = (operator || "").toLowerCase()
  if (op === "is") {
    if (value === null) return rows.filter((item) => item[column] != null)
    return rows.filter((item) => item[column] !== value)
  }
  if (op === "eq") return rows.filter((item) => item[column] !== value)
  if (op === "in") {
    const values = Array.isArray(value) ? value : []
    return rows.filter((item) => !values.includes(item[column]))
  }
  return rows
}
