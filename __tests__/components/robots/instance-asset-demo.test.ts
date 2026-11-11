import { demoInstanceAssetSummaries } from '@/lib/demo-data/instance-asset-summaries'

it('summarizes existing demo assets and rejects another site', () => {
  const data = { remote_instances: [{ id: 'instance', site_id: 'site' }], assets: [
    { id: 'asset', instance_id: 'instance', site_id: 'site', file_type: 'image/png', file_path: 'demo.png' },
    { id: 'hidden', instance_id: 'instance', site_id: 'other', file_type: 'image/png', file_path: 'private.png' },
  ] }
  const result = demoInstanceAssetSummaries(data, 'site', { p_site_id: 'site', p_instance_ids: ['instance'] })
  expect(result.data?.[0]).toMatchObject({ asset_count: 1, avatar_path: 'demo.png' })
  expect(demoInstanceAssetSummaries(data, 'site', { p_site_id: 'other', p_instance_ids: ['instance'] }).error).toBeTruthy()
})