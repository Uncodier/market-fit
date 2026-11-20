export function catalogFilters(params: Pick<URLSearchParams, "get">) {
  const category = params.get("category") || ""
  return {
    tab: params.get("tab") === "connected" ? "connected" : "all",
    q: (params.get("q") || "").slice(0, 200).trim(),
    category: /^[a-z0-9_-]{1,80}$/i.test(category) ? category : "",
    cursor: (params.get("cursor") || "").slice(0, 2000),
    page: /^[1-9][0-9]{0,5}$/.test(params.get("page") || "") && Number(params.get("page")) <= 100_000 ? Number(params.get("page")) : 1,
  }
}

export function catalogQuery(filters: ReturnType<typeof catalogFilters>) {
  const params = new URLSearchParams({ tab: filters.tab })
  for (const key of ["q", "category", "cursor"] as const) if (filters[key]) params.set(key, filters[key])
  if (filters.page > 1 && !filters.cursor) params.set("page", String(filters.page))
  return params
}