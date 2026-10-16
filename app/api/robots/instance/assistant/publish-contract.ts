import { buildPublishRouting } from "@/app/components/agents/imprenta-publish-routing"
import type { ImprentaNodeSnapshot } from "./imprenta-contract"
import type { createClient } from "@/lib/supabase/server"

type JsonRecord = Record<string, unknown>
function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {}
}

export class PublishContractValidationError extends Error {
  readonly status = 400
}

/** Existing nodes display Blog by default only when their trusted site has a URL. */
export async function resolveImplicitPublishDestinations(
  node: ImprentaNodeSnapshot,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ImprentaNodeSnapshot> {
  if (node.type !== "publish" || record(node.settings).publish_destinations !== undefined) return node
  const { data: site, error } = await supabase.from("sites").select("url").eq("id", node.site_id).maybeSingle()
  if (error || typeof site?.url !== "string" || !site.url.trim()) {
    throw new PublishContractValidationError("Choose a publish destination before executing")
  }
  return { ...node, settings: { ...record(node.settings), publish_destinations: ["blog"] } }
}

/** Bind execution to the saved node; cached UI/tool arguments cannot replace its targets. */
export function strengthenPublishPayload(body: JsonRecord, context: JsonRecord, node?: ImprentaNodeSnapshot): JsonRecord {
  const destinations = node ? record(node.settings).publish_destinations : context.publish_destinations
  if (!Array.isArray(destinations) || !destinations.length || destinations.length > 20
    || destinations.some((value) => typeof value !== "string" || !value.trim() || value.trim() !== value)) {
    throw new PublishContractValidationError("Choose at least one valid publish destination before executing")
  }
  let routing: ReturnType<typeof buildPublishRouting>
  try {
    routing = buildPublishRouting(destinations)
  } catch {
    throw new PublishContractValidationError("Invalid publish destination selection")
  }
  const overrides = record(body.tool_overrides)
  const bind = (existing: unknown, canonical: JsonRecord) => {
    const clean = { ...record(existing) }
    for (const key of ["channel", "connection_id", "delivery_routes", "social_accounts", "social_account_targets", "audience_email_mode", "voice_mode", "from"]) delete clean[key]
    return { ...clean, ...canonical }
  }
  // Explicit route lists are necessary even across different channels: never
  // let the model turn a multi-destination selection into one arbitrary send.
  const routeOverride = routing.deliveryRoutes.length > 1 ? { delivery_routes: routing.deliveryRoutes } : {}
  const testDestination = record(context.test_destination)
  const testRecipients = context.is_test === true && routing.deliveryRoutes.length > 1
    ? { test_recipients: {
        ...(typeof testDestination.email === "string" ? { email: testDestination.email } : {}),
        ...(typeof testDestination.phone === "string" ? { phone: testDestination.phone } : {}),
      } }
    : {}
  return {
    ...body,
    ...(node ? { instance_id: node.instance_id, site_id: node.site_id } : {}),
    context: JSON.stringify({
      ...context, nodeType: "publish", output_type: "publish", mediaType: "publish",
      publish_destinations: destinations, publish_channels: routing.deliveryChannels,
      channel_routing: routing.channelRouting, distributionModes: routing.distributionModes,
      publish_voice_mode: routing.voiceMode,
    }),
    tool_overrides: {
      ...overrides,
      publish: bind(overrides.publish, { ...routing.publishOverride, ...routeOverride, ...testRecipients }),
      sendBulkMessages: bind(overrides.sendBulkMessages, { ...routing.bulkMessageOverride, ...routeOverride }),
    },
  }
}