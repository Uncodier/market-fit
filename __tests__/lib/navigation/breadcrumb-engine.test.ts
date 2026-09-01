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

  it('keeps Conversations as origin when going to a lead', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/chat?conversationId=123', 'Chat: Maria'))
    state = reduceBreadcrumb(state, nav('/leads/456?name=Maria', 'Maria Garcia'))

    expect(state).toEqual([
      { path: '/chat', label: 'Chat', timestamp },
      { path: '/leads/456?name=Maria', label: 'Maria Garcia', timestamp },
    ])
  })

  it('collapses a stale chat list + conversation trail when going to a lead', () => {
    const stale = [
      { path: '/chat', label: 'Chat', timestamp: 1 },
      { path: '/chat?conversationId=123', label: 'Chat: Maria', timestamp: 2 },
    ]
    const state = reduceBreadcrumb(stale, nav('/leads/456', 'Maria Garcia'))

    expect(state).toEqual([
      { path: '/chat', label: 'Chat', timestamp: 1 },
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

  it('ignores a destination-section parent on a cross-section trail', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/leads/456', 'Maria Garcia'))
    state = reduceBreadcrumb(
      state,
      upd('Maria Garcia', { title: 'Leads', path: '/leads' }, '/leads/456')
    )

    expect(state).toEqual([
      { path: '/chat', label: 'Chat', timestamp },
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

  it('resets when navigating to a sidebar root', () => {
    let state = reduceBreadcrumb([], nav('/chat', 'Chat'))
    state = reduceBreadcrumb(state, nav('/leads/456', 'Maria Garcia'))
    state = reduceBreadcrumb(state, nav('/catalog', 'Catalog'))

    expect(state).toEqual([{ path: '/catalog', label: 'Catalog', timestamp }])
  })
})
