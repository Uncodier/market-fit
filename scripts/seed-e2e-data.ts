import { fixtureClient } from '../tests/support/mutation-fixtures'
import { required, requireUuid } from '../tests/support/mutation-safety'

/** Compatibility entry point: verifies explicit fixtures; never seeds or resets data. */
export async function verifyE2EFixtures(env: NodeJS.ProcessEnv = process.env) {
  const itemId = requireUuid(required(env, 'TEST_RESERVABLE_ITEM_ID'), 'TEST_RESERVABLE_ITEM_ID')
  const scheduleId = requireUuid(required(env, 'TEST_RESERVATION_SCHEDULE_ID'), 'TEST_RESERVATION_SCHEDULE_ID')
  const leadId = requireUuid(required(env, 'TEST_LEAD_ID'), 'TEST_LEAD_ID')
  const campaignId = requireUuid(required(env, 'TEST_CAMPAIGN_ID'), 'TEST_CAMPAIGN_ID')
  const { client, siteId } = await fixtureClient(env)
  const fixtures = [
    ['catalog_items', itemId, 'id,name,is_reservation,status'],
    ['reservation_schedules', scheduleId, 'id,catalog_item_id'],
    ['leads', leadId, 'id'],
    ['campaigns', campaignId, 'id,title'],
  ]
  for (const [table, id, fields] of fixtures) {
    const result = await client.from(table).select(fields).eq('site_id', siteId).eq('id', id).single()
    if (result.error || !result.data) throw new Error(`Required disposable ${table} fixture is unavailable`)
    const row = result.data as unknown as Record<string, unknown>
    if (table === 'catalog_items' && (row.is_reservation !== true || row.status !== 'active')) {
      throw new Error('TEST_RESERVABLE_ITEM_ID must identify an active reservable catalog item')
    }
    if (table === 'reservation_schedules' && row.catalog_item_id !== itemId) {
      throw new Error('TEST_RESERVATION_SCHEDULE_ID must belong to TEST_RESERVABLE_ITEM_ID')
    }
    if (table === 'campaigns' && row.title !== required(env, 'TEST_CAMPAIGN_NAME')) {
      throw new Error('TEST_CAMPAIGN_ID does not match TEST_CAMPAIGN_NAME')
    }
  }
}

if (require.main === module) {
  verifyE2EFixtures().then(() => {
    console.log('Explicit disposable E2E fixtures verified; no data was changed.')
  }).catch((error: Error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
