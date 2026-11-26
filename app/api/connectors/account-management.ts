import { accountManagementReceipt, accountManagementUpdate } from "@/app/connectors/account-management-contract"
import type { createClient } from "@/lib/supabase/server"

export async function manageConnectorAccount(
  supabase: Awaited<ReturnType<typeof createClient>>, siteId: string, connectorId: string, body: Record<string, unknown>,
) {
  const revision = Number(body.expected_revision)
  const update = accountManagementUpdate.parse({ operation: body.operation,
    ...(body.operation === "rename" && { display_name: body.display_name }),
  })
  const { data, error } = await supabase.rpc("connector_manage_account", {
    p_site_id: siteId, p_connector_id: connectorId, p_expected_revision: revision, p_operation: update.operation,
    ...(update.operation === "rename" && { p_display_name: update.display_name }),
  }).abortSignal(AbortSignal.timeout(5_000))

  if (error?.code === "42501") return { status: 403, code: "ACCESS_DENIED" } as const
  if (error?.code === "40001") return { status: 409, code: "REVISION_CONFLICT" } as const
  if (error?.code === "22023") return { status: 400, code: "INVALID_REQUEST" } as const
  if (error) return { status: 503, code: "STORAGE_UNAVAILABLE" } as const
  const receipt = accountManagementReceipt(connectorId, revision, update).safeParse(data)
  return receipt.success ? { status: 200, data: receipt.data } as const : { status: 502, code: "OUTCOME_UNKNOWN" } as const
}