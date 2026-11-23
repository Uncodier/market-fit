import { z } from "zod"
import { askAccessIntent, directPolicyUpdate } from "@/app/connectors/provider-direct-contract"
import { toolActionFilterSchema } from "@/app/connectors/tool-action-types"

const uuid = z.string().uuid()
const expires = z.string().datetime({ offset: true }).nullable().optional()
const member = z.object({ user_id: uuid, can_view: z.boolean(), can_use: z.boolean(), expires_at: expires }).strict()
  .refine(value => !value.can_use || value.can_view, "Use requires view")
const agent = z.object({ agent_id: uuid, enabled: z.boolean(), expires_at: expires }).strict()
const site = z.object({ site_id: uuid }).strict()
const versioned = site.extend({ expected_revision: z.number().int().min(0) })
const slug = /^[a-z0-9][a-z0-9_-]{0,99}$/

export function connectorRoute(path: string[], method: string) {
  if (!path.length || path.length > 3 || path.some(value => !/^[a-zA-Z0-9_-]+$/.test(value))) return null
  if (method === "GET") {
    if (path.length === 1 && path[0] === "approvals") return "approval-inbox"
    if (path.length === 1 && path[0] === "domain-counts") return "domain-counts"
    if (path.length === 1 && ["catalog", "connections"].includes(path[0])) return "read"
    if (path[0] === "connections" && path.length === 2 && uuid.safeParse(path[1]).success) return "connection-summary"
    if (path[0] === "catalog" && path.length === 2 && slug.test(path[1])) return "read"
    if (path[0] === "catalog" && path.length === 3 && slug.test(path[1]) && path[2] === "tools") return "tool-catalog"
    if (path[0] === "connections" && path.length === 3 && uuid.safeParse(path[1]).success && path[2] === "access") return "read"
    if (path[0] === "auth-attempts" && path.length === 2 && uuid.safeParse(path[1]).success) return "attempt"
  }
  if (method === "POST" && path[0] === "auth-attempts" && (path.length === 1 || (path.length === 2 && path[1] === "ask"))) return "start"
  if (method === "POST" && path.length === 1 && path[0] === "managed-oauth") return "managed-oauth"
  if (method === "POST" && path.length === 1 && path[0] === "supabase-token") return "supabase-token"
  if (path.length === 3 && uuid.safeParse(path[1]).success) {
    if (method === "POST" && path[0] === "approvals" && ["approve", "reject"].includes(path[2])) return "approval-decision"
    if (method === "POST" && path[0] === "auth-attempts" && path[2] === "complete") return "complete"
    if (path[0] === "connections") {
      if ((method === "GET" || method === "PATCH") && path[2] === "provider-direct") return "provider-direct"
      if (method === "POST" && path[2] === "bind-project") return "bind-project"
      if (method === "POST" && ["disconnect", "sync"].includes(path[2])) return "disconnect"
      if (method === "PATCH" && path[2] === "access") return "access"
      if (method === "PATCH" && path[2] === "policy") return "policy"
    }
  }
  return null
}

export function parseConnectorBody(kind: string, input: unknown) {
  if (kind === "provider-direct") return directPolicyUpdate.parse(input)
  if (kind === "bind-project") return site.extend({ expected_revision: z.number().int().positive().max(2_147_483_646),
    project_ref: z.string().length(20).regex(/^[a-z]{20}$/) }).strict().parse(input)
  if (kind === "approval-decision") return site.parse(input)
  if (kind === "start") return site.extend({ toolkit_slug: z.string().regex(slug), auth_config_id: z.string().regex(/^[a-zA-Z0-9_-]{1,150}$/) }).strict().parse(input)
  if (kind === "managed-oauth") return site.extend({ toolkit_slug: z.string().regex(slug) }).strict().parse(input)
  if (kind === "supabase-token") return site.extend({ delegate_account: z.literal(true).optional(), project_ref: z.string().regex(/^[a-z0-9]{20}$/),
    token: z.string().min(24).max(512).regex(/^sbp_[A-Za-z0-9_-]+$/) }).strict().parse(input)
  if (kind === "complete") return z.object({ session_uri: z.string().min(1).max(4096) }).strict().parse(input)
  if (kind === "disconnect") return versioned.parse(input)
  if (kind === "access") return versioned.extend({ members: z.array(member).max(100).default([]), agents: z.array(agent).max(100).default([]) }).strict().parse(input)
  if (kind === "policy") return z.union([versioned.extend({ catalog_reads: z.literal(false) }).strict(), versioned.extend({
    catalog_reads: z.boolean().optional(),
    ask_access: askAccessIntent.optional(),
    tool_access_mode: z.enum(["all", "selected"]).optional(),
    support_publication: z.null().optional(),
    allowed_tools: z.array(z.string().regex(/^[A-Z0-9][A-Z0-9_]{0,149}$/)).max(100),
    allowed_hosts: z.array(z.enum(["assistant", "direct"])).max(2),
    require_approval: z.boolean(), enabled: z.boolean(),
  }).strict().refine(value => !value.ask_access || (
    value.tool_access_mode && value.catalog_reads !== false && value.expected_revision > 0 && value.expected_revision <= 2_147_483_646 &&
    value.allowed_hosts.includes("assistant") === value.ask_access.enabled &&
    (!value.ask_access.enabled || (value.enabled && (value.tool_access_mode === "all" || value.allowed_tools.length > 0)))
  ))]).parse(input)
  throw new Error("Unsupported connector operation")
}

export function parseConnectorQuery(query: URLSearchParams, kind?: string) {
  if ([...new Set(query.keys())].some(key => query.getAll(key).length !== 1)) throw new SyntaxError("Duplicate query")
  if (kind === "provider-direct") return site.parse(Object.fromEntries(query))
  const page = z.string().regex(/^[1-9][0-9]{0,5}$/).refine(value => Number(value) <= 100_000).optional()
  if (kind === "tool-catalog") return site.extend({
    q: z.string().max(200).optional(), cursor: z.string().max(2048).optional(), page, action: toolActionFilterSchema.optional(),
  }).refine(value => !(value.cursor && value.page), "Choose a page or cursor, not both").parse(Object.fromEntries(query))
  const scope = site.extend({ q: z.string().max(200).optional(), tab: z.enum(["all", "connected"]).optional() })
  const schema = kind === "domain-counts" ? scope.extend({
    q: z.string().trim().max(200).regex(/^[^\u0000-\u001f\u007f]*$/).optional(),
  }) : scope.extend({
    category: z.string().max(100).optional(), cursor: z.string().max(2048).optional(),
    page,
  })
  return schema.parse(Object.fromEntries(query))
}