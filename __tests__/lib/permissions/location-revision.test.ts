import { locationPermissionRevision } from '@/lib/permissions/location-revision'

const siteId = '00000000-0000-4000-8000-000000000001'
const a = '00000000-0000-4000-8000-000000000002'
const b = '00000000-0000-4000-8000-000000000003'
const scope = { site_id: siteId, role: 'collaborator', revision: 0, restricted_location_ids: [a, b] }

it('normalizes sets but changes on revocation, role, or audit revision', () => {
  const before = locationPermissionRevision(scope, siteId)
  expect(locationPermissionRevision({ ...scope, restricted_location_ids: [b, a] }, siteId)).toBe(before)
  expect(locationPermissionRevision({ ...scope, revision: 1 }, siteId)).not.toBe(before)
  expect(locationPermissionRevision({ ...scope, role: 'marketing' }, siteId)).not.toBe(before)
  expect(locationPermissionRevision({ ...scope, restricted_location_ids: [] }, siteId)).not.toBe(before)
  expect(locationPermissionRevision(null, siteId)).toBe('unavailable')
})

it('never fingerprints malformed or foreign permission responses as an empty grant', () => {
  expect(locationPermissionRevision({}, siteId)).toBeNull()
  expect(locationPermissionRevision({ ...scope, site_id: a }, siteId)).toBeNull()
  expect(locationPermissionRevision({ ...scope, revision: undefined }, siteId)).toBeNull()
})