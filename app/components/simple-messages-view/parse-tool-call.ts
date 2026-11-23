import { InstanceLog } from './types'

const WRAPPER_TOOLS = new Set(['tool_lookup', 'tools'])
const META_PREFIX = 'meta:'

export interface ToolCallMeta {
  rawName: string | null
  /** Normalized wrapper name (`tools`) when the log is a lookup/dispatcher call */
  wrapper: boolean
  action: string | null
  /** Tool being invoked (nested `name` for wrappers, otherwise the tool itself) */
  target: string | null
  thought: string | null
  privateArguments?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/^['"]|['"]$/g, '').trim()
  return trimmed && trimmed !== 'unknown' ? trimmed : null
}

/** Parse `key=value` pairs from a tool log message (`tools: action=describe, name=webSearch`). */
export function parseToolMessageKvs(message: string | null | undefined): Record<string, string> {
  if (!message) return {}
  const body = message.replace(/^[A-Za-z][\w-]*:\s*/, '')
  const out: Record<string, string> = {}
  const re =
    /(?:^|[,:\s])([A-Za-z_][\w]*)=(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|(\{[\s\S]*?\})|([^,]+))/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    const key = match[1]
    const raw = match[2] ?? match[3] ?? match[4] ?? match[5] ?? ''
    out[key] = raw.trim()
  }
  return out
}

function pickFromObject(obj: unknown): { action: string | null; name: string | null } {
  const record = asRecord(obj)
  if (!record) return { action: null, name: null }
  return {
    action: pickString(record.action),
    name: pickString(record.name),
  }
}

function firstString(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value) return value
  }
  return null
}

function originFromRef(value: unknown) {
  if (typeof value !== 'string') return null
  if (/^\s*report\s*:/i.test(value)) return 'makinari_report'
  if (/^\s*connector\s*:/i.test(value)) return 'provider'
  return null
}

export function getToolCallMeta(log: InstanceLog): ToolCallMeta {
  const rawName = log.tool_name || log.toolName || null
  const wrapper = Boolean(rawName && WRAPPER_TOOLS.has(rawName))

  const kvs = parseToolMessageKvs(log.message)
  const args = asRecord(log.tool_args)
  // New shared logs carry only server-projected categories; never derive a display
  // name from an account label, nested argument, result or the tail of a reference.
  const directOrigin = originFromRef(rawName)
  const facade = rawName === 'use_composio_tools'
  const operation = directOrigin ? 'call' : args?.action ?? kvs.action
  const output = (log.tool_result || log.tool_results)?.output
  const privatePage = wrapper && (operation === 'search' || operation === 'list') &&
    (output?.connector_next_cursor != null || (operation === 'search' && output?.connector_status && output?.query === undefined) ||
      (Array.isArray(output?.tools) && output.tools.some((tool: any) => originFromRef(tool?.name) || tool?.connector_id || tool?.account_label || tool?.tool_origin)))
  const queryOrigin = (operation === 'search' || operation === 'list') && (originFromRef(args?.query) || originFromRef(kvs.query))
  const origin = directOrigin || queryOrigin || originFromRef(args?.name) || originFromRef(args?.action_name) || originFromRef(kvs.name) || originFromRef(kvs.action_name)
  if (directOrigin || ((wrapper || facade || rawName === 'skill_lookup') && (
    origin || facade || privatePage || (rawName === 'skill_lookup' && output?.connector_capabilities?.capabilities?.length) ||
    args?.name === 'use_composio_tools' || args?.private_arguments === true || kvs.private_arguments === 'true' ||
    ['connector_id', 'connector_cursor', 'catalog_query', 'tool_origin'].some(key => (args && Object.hasOwn(args, key)) || Object.hasOwn(kvs, key))
  ))) {
    const category = origin || args?.tool_origin || kvs.tool_origin
    const target = category === 'makinari_report' ? 'Internal Makinari report' : category === 'provider' ? 'Provider connector' : 'Private tools'
    const action = operation === 'execute' ? 'call' : typeof operation === 'string' && ['call', 'describe', 'search', 'list', 'get'].includes(operation) ? operation : null
    return { rawName: directOrigin ? 'tools' : rawName, wrapper: true, action, target, thought: null, privateArguments: true }
  }
  const fromArgs = pickFromObject(log.tool_args)
  const fromDetails = pickFromObject(log.details)
  const fromResult = pickFromObject(log.tool_result || log.tool_results)

  const action = firstString(
    kvs.action,
    fromArgs.action,
    fromDetails.action,
    wrapper ? fromResult.action : null
  )
  const nestedName = firstString(
    kvs.name,
    fromArgs.name,
    fromDetails.name,
    wrapper ? fromResult.name : null
  )
  const thought = pickString(kvs.thought_process)

  return {
    rawName,
    wrapper,
    action,
    target: wrapper ? nestedName : rawName,
    thought,
  }
}

/**
 * Grouping key for consecutive tool rows.
 * Wrappers (`tool_lookup` / `tools`) encode action + nested tool so the UI can show both.
 * Other tools encode action when present so list vs update stay distinct.
 */
export function getToolName(log: InstanceLog): string | null {
  const meta = getToolCallMeta(log)
  if (!meta.rawName) return null

  if (meta.wrapper) {
    return `${META_PREFIX}tools:${meta.action || 'unknown'}:${meta.target || 'unknown'}`
  }

  if (meta.action) {
    return `${META_PREFIX}${meta.rawName}:${meta.action}:${meta.rawName}`
  }

  return meta.rawName
}

function titleCaseAction(action: string): string {
  return action
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Converts snake_case / encoded meta keys to a display label, action first. */
export function formatToolDisplayName(name: string): string {
  if (name.startsWith(META_PREFIX)) {
    const parts = name.slice(META_PREFIX.length).split(':')
    const action = parts[1] && parts[1] !== 'unknown' ? parts[1] : ''
    const target = parts[2] && parts[2] !== 'unknown' ? parts[2] : parts[0] !== 'tools' ? parts[0] : ''

    if (action && target) return `${titleCaseAction(action)}: ${target}`
    if (action) return titleCaseAction(action)
    if (target) return target
    return 'Tools'
  }

  if (name.startsWith('tools_meta:')) {
    return formatToolDisplayName(`${META_PREFIX}${name.replace('tools_meta:', 'tools:')}`)
  }

  if (name.startsWith('tool_lookup_')) {
    return formatToolDisplayName(`${META_PREFIX}tools:unknown:${name.replace('tool_lookup_', '')}`)
  }

  if (name === 'tool_lookup' || name === 'tools') return 'Tools'

  return name
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/** Subtitle next to the title: thought_process when the message is a kv dump. */
export function getToolCallSubtitle(log: InstanceLog): string | null {
  const meta = getToolCallMeta(log)
  if (meta.privateArguments) return null
  if (meta.thought) return meta.thought

  const message = log.message?.trim()
  if (!message) return null

  const looksLikeKvDump =
    /(?:^|\s)(?:action|name|thought_process|args)=/.test(message) ||
    /^(tool_lookup|tools)\s*:/.test(message)

  if (looksLikeKvDump) return null
  return message
}
