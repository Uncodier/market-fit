import { reduceBreadcrumb, BreadcrumbEvent } from '@/lib/navigation/breadcrumb-engine'

describe('breadcrumb-engine', () => {
  const timestamp = 1000
  const nav = (path: string, label: string): BreadcrumbEvent => ({ type: 'navigate', path, label, timestamp })
  const upd = (
    title?: string,
    parent?: { title: string; path: string },
    path?: string
  ): BreadcrumbEvent => ({ type: 'update', title, parent, path })

  it('keeps a single Conversations crumb when opening a conversation', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    expect(state).toEqual([{ path: '/chat', label: 'Chat', timestamp }])

    state = reduceBreadcrumb(state, nav('/chat?conversationId=123', 'Chat: Maria'))
    expect(state).toEqual([{ path: '/chat', label: 'Chat', timestamp }])
  })

  it('uses the destination section when opening a lead from Chat', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/chat?conversationId=123', 'Chat: Maria'))
    state = reduceBreadcrumb(state, nav('/leads/456?name=Maria', 'Maria Garcia'))

    expect(state).toEqual([
      { path: '/leads', label: 'Leads', timestamp: timestamp - 1 },
      { path: '/leads/456?name=Maria', label: 'Maria Garcia', timestamp },
    ])
  })

  it('replaces a stale chat trail with the destination section when opening a lead', () => {
    const stale = [
      { path: '/chat', label: 'Chat', timestamp: 1 },
      { path: '/chat?conversationId=123', label: 'Chat: Maria', timestamp: 2 },
    ]
    const state = reduceBreadcrumb(stale, nav('/leads/456', 'Maria Garcia'))

    expect(state).toEqual([
      { path: '/leads', label: 'Leads', timestamp: timestamp - 1 },
      { path: '/leads/456', label: 'Maria Garcia', timestamp },
    ])
  })

  it('appends a lead under Leads and replaces sibling leads', () => {
    let state = reduceBreadcrumb([], nav('/leads', 'Leads'))
    state = reduceBreadcrumb(state, nav('/leads/456', 'Maria Garcia'))

    expect(state).toEqual([
      { path: '/leads', label: 'Leads', timestamp },
      { path: '/leads/456', label: 'Maria Garcia', timestamp },
    ])

    state = reduceBreadcrumb(state, nav('/leads/789', 'John Doe'))
    expect(state).toEqual([
      { path: '/leads', label: 'Leads', timestamp },
      { path: '/leads/789', label: 'John Doe', timestamp },
    ])
  })

  it('keeps a single destination-section parent after a detail title update', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/leads/456', 'Maria Garcia'))
    state = reduceBreadcrumb(
      state,
      upd('Maria Garcia', { title: 'Leads', path: '/leads' }, '/leads/456')
    )

    expect(state).toEqual([
      { path: '/leads', label: 'Leads', timestamp: timestamp - 1 },
      { path: '/leads/456', label: 'Maria Garcia', timestamp },
    ])
  })

  it('inserts Catalog parent on a same-section detail', () => {
    let state = reduceBreadcrumb([], nav('/catalog/123', 'Item Details'))
    state = reduceBreadcrumb(
      state,
      upd('T-Shirt', { title: 'Catalog', path: '/catalog' }, '/catalog/123')
    )

    expect(state).toEqual([
      { path: '/catalog', label: 'Catalog', timestamp: timestamp - 1 },
      { path: '/catalog/123', label: 'T-Shirt', timestamp },
    ])
  })

  it.each([
    ['/catalog/123', 'Catalog', '/catalog'],
    ['/applications/repositories/123', 'Code', '/applications/repositories'],
  ])('labels the destination parent for %s before page metadata arrives', (path, label, parent) => {
    const state = reduceBreadcrumb(
      reduceBreadcrumb([], nav('/chat', 'Chat')),
      nav(path, 'Details')
    )

    expect(state).toEqual([
      { path: parent, label, timestamp: timestamp - 1 },
      { path, label: 'Details', timestamp },
    ])
  })

  it('preserves an existing root label when normalizing a conversation', () => {
    const state = reduceBreadcrumb(
      reduceBreadcrumb([], nav('/chat', 'Conversations')),
      nav('/chat?conversationId=123', 'Chat: Maria')
    )

    expect(state).toEqual([{ path: '/chat', label: 'Conversations', timestamp }])
  })

  it('resets when navigating to a sidebar root', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/leads/456', 'Maria Garcia'))
    state = reduceBreadcrumb(state, nav('/catalog', 'Catalog'))

    expect(state).toEqual([{ path: '/catalog', label: 'Catalog', timestamp }])
  })
})
