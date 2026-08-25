import type { PermissionCommand } from "./types"

type RpcClient = {
  rpc: (
    fn: string,
    args: { p_site_id: string; p_command: string }
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

export async function userCanOnSite(
  supabase: RpcClient,
  siteId: string,
  command: PermissionCommand
): Promise<boolean> {
  const { data, error } = await supabase.rpc("user_can", {
    p_site_id: siteId,
    p_command: command,
  })
  if (error) return false
  return data === true
}
