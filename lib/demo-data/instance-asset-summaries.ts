interface Row { id: string; site_id?: string; instance_id?: string; file_path?: string; file_type?: string; created_at?: string }

/** Demo-only projection of existing fixtures; production always uses the RLS RPC. */
export function demoInstanceAssetSummaries(data: Record<string, Row[]>, siteId: string, params: { p_site_id?: string; p_instance_ids?: string[] }) {
  const ids = params.p_instance_ids
  if (params.p_site_id !== siteId || !ids || ids.length > 100) return { data: null, error: { message: "Invalid summary scope" } }
  return { error: null, data: (data.remote_instances || []).filter(row => ids.includes(row.id) && row.site_id === siteId).map(instance => {
    const assets = (data.assets || []).filter(row => row.instance_id === instance.id && row.site_id === siteId)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "") || b.id.localeCompare(a.id))
    return { instance_id: instance.id, asset_count: assets.length, recent_assets: assets.slice(0, 3),
      avatar_path: assets.find(row => row.file_type?.startsWith("image/"))?.file_path || null }
  }) }
}