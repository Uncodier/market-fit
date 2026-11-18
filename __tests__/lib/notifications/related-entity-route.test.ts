import { existsSync } from 'node:fs'
import path from 'node:path'
import { getNotificationTarget, safeNotificationActionUrl } from '@/lib/notifications/related-entity-route'

const routes = [
  ['conversation', '/chat?conversationId=item-1', 'Go to chat', 'app/chat/page.tsx'],
  ['task', '/control-center/item-1', 'Go to task', 'app/control-center/[id]/page.tsx'],
  ['instance', '/robots?instance=item-1', 'Go to instance', 'app/robots/page.tsx'],
  ['lead', '/leads/item-1', 'Go to lead', 'app/leads/[id]/page.tsx'],
  ['site', '/projects', 'Go to projects', 'app/projects/page.tsx'],
  ['campaign', '/campaigns/item-1', 'Go to campaign', 'app/campaigns/[id]/page.tsx'],
  ['content', '/content/item-1', 'Go to content', 'app/content/[id]/page.tsx'],
  ['requirement', '/requirements/item-1', 'Go to requirement', 'app/requirements/[id]/page.tsx'],
  ['segment', '/segments/item-1', 'Go to segment', 'app/segments/[id]/page.tsx'],
] as const

describe('notification related entity routes', () => {
  it.each(routes)('maps %s to an existing page', (type, href, label, page) => {
    expect(getNotificationTarget({ related_entity_type: type, related_entity_id: 'item-1' })).toEqual({ href, label })
    expect(existsSync(path.join(process.cwd(), page))).toBe(true)
  })

  it('uses only the conversation ID, without inventing an agent', () => {
    const target = getNotificationTarget({ related_entity_type: 'conversation', related_entity_id: 'a/b?x=1&y=2' })!
    const url = new URL(target.href, 'https://notifications.invalid')
    expect(url.searchParams.get('conversationId')).toBe('a/b?x=1&y=2')
    expect([...url.searchParams.keys()]).toEqual(['conversationId'])
  })

  it('encodes path IDs and normalizes entity names', () => {
    expect(getNotificationTarget({ related_entity_type: ' LEAD ', related_entity_id: 'a/b?#' })?.href).toBe('/leads/a%2Fb%3F%23')
    const target = getNotificationTarget({ related_entity_type: 'instance', related_entity_id: 'a/b?x=1&y=2' })!
    expect(new URL(target.href, 'https://notifications.invalid').searchParams.get('instance')).toBe('a/b?x=1&y=2')
  })

  it.each([undefined, null, '', ' ', '.', '..'])('does not fabricate a route for an absent or invalid ID: %s', id => {
    expect(getNotificationTarget({ related_entity_type: 'lead', related_entity_id: id })).toBeNull()
  })

  it.each(['unknown', 'constructor', '__proto__', 'toString'])('does not fabricate an unknown entity route: %s', type => {
    expect(getNotificationTarget({ related_entity_type: type, related_entity_id: 'item-1' })).toBeNull()
  })

  it('prioritizes a safe existing action_url for aggregate and billing notifications', () => {
    expect(getNotificationTarget({ related_entity_type: 'site', related_entity_id: 'site-1', action_url: '/campaigns' })).toEqual({ href: '/campaigns', label: 'Go to details' })
    expect(getNotificationTarget({ action_url: '/billing?tab=credits#balance' })).toEqual({ href: '/billing?tab=credits#balance', label: 'Go to details' })
  })

  it('retains the entity label for an explicit matching action', () => {
    expect(getNotificationTarget({ related_entity_type: 'lead', related_entity_id: 'item-1', action_url: '/leads/item-1' })?.label).toBe('Go to lead')
  })

  it('falls back to actual entity routes for unsafe or obsolete action URLs', () => {
    for (const action_url of ['https://outside.invalid', '/sites/site-1/instances/item-1']) {
      expect(getNotificationTarget({ related_entity_type: 'instance', related_entity_id: 'item-1', action_url })?.href).toBe('/robots?instance=item-1')
    }
  })
})

describe('safe notification action URLs', () => {
  it.each(['https://outside.invalid', '//outside.invalid', 'javascript:alert(1)', '/\\outside.invalid', '/%5coutside.invalid', '/%2f%2foutside.invalid', '/path\nnext', '/path%00next', '/%zz', ' /billing'])('rejects unsafe URL %s', value => {
    expect(safeNotificationActionUrl(value)).toBeNull()
    expect(getNotificationTarget({ action_url: value })).toBeNull()
  })

  it.each(['/billing', '/leads?search=Test%20Lead#results'])('accepts same-app path %s', value => {
    expect(safeNotificationActionUrl(value)).toBe(value)
  })
})