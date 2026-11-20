"use client"

import { z } from "zod"
import { useConnectorResource } from "./use-connector-resource"
import { exactToolIdPattern } from "./connector-request"

const toolsSchema = z.object({
  items: z.array(z.object({ slug: z.string().regex(exactToolIdPattern), name: z.string(), description: z.string(), reviewed: z.boolean() })),
  next_cursor: z.string().nullable(), total: z.number().int().nonnegative().nullable(),
  current_page: z.number().int().positive().optional(), total_pages: z.number().int().positive().nullable().optional(),
})

export function useToolCatalog(siteId: string, slug: string, page: number, search = "") {
  const params = new URLSearchParams({ site_id: siteId, page: String(page) })
  if (search.trim()) params.set("q", search.trim())
  const resource = useConnectorResource(`/api/connectors/catalog/${encodeURIComponent(slug)}/tools?${params}`, toolsSchema)
  const data = resource.data
  const currentPage = data?.current_page ?? page
  const totalPages = data?.total_pages ?? (data?.total == null ? null : Math.max(1, Math.ceil(data.total / 20)))
  return { ...resource, currentPage, totalPages }
}
