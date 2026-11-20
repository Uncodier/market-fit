import { act, renderHook } from '@testing-library/react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useNavigationHistory } from '@/app/hooks/use-breadcrumb-history'
import { NAVIGATION_AREAS } from '@/app/config/navigation-areas'
import { workspaceScreenTitle } from '@/lib/navigation/workspace-screen'

function setRoute(path: string) {
  const [pathname, query] = path.split('?')
  jest.mocked(usePathname).mockReturnValue(pathname)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(performance, 'getEntriesByType', {
    configurable: true, value: jest.fn(() => []),
  })
})

test('the real hook repairs persisted Purchases history and resets every sidebar destination', () => {
  setRoute('/purchases/procurement/approvals')
  localStorage.setItem('navigationHistory', JSON.stringify({ items: [
    { path: '/purchases', label: 'Compras', timestamp: 1 },
    { path: '/purchases/procurement/approvals', label: 'Approvals', timestamp: 2 },
  ] }))
  const hook = renderHook(() => useNavigationHistory())
  expect(hook.result.current.items).toHaveLength(1)
  expect(hook.result.current.items[0].path).toBe('/purchases/procurement/approvals')

  const paths = [...new Set(Object.values(NAVIGATION_AREAS).flatMap(area => area.items.map(item => item.href)))]
  for (const path of paths) {
    sessionStorage.setItem('uiNavTimestamp', String(Date.now()))
    setRoute(path)
    hook.rerender()
    expect(hook.result.current.items).toHaveLength(1)
    expect(hook.result.current.items[0].path).toBe(path)
    const label = workspaceScreenTitle(path)
    if (label) expect(hook.result.current.items[0].label).toBe(label)
    expect(JSON.parse(localStorage.getItem('navigationHistory')!).items).toEqual(hook.result.current.items)
  }
})

test('title updates and detail navigation retain a real request parent', () => {
  setRoute('/purchases/requests')
  const hook = renderHook(() => useNavigationHistory())
  setRoute('/purchases/requests/id')
  sessionStorage.setItem('uiNavTimestamp', String(Date.now()))
  hook.rerender()
  act(() => window.dispatchEvent(new CustomEvent('breadcrumb:update', {
    detail: { title: 'Office supplies', path: '/purchases/requests/id' },
  })))
  expect(hook.result.current.items.map(item => item.path)).toEqual([
    '/purchases/requests', '/purchases/requests/id',
  ])
  expect(hook.result.current.items[1].label).toBe('Office supplies')
})

test.each([
  [true, '/robots?instance=one', '/robots', '/robots?view=instances'],
  [true, '/robots?instance=one&mode=workflow', '/robots', '/robots?mode=workflow&view=instances'],
  [true, '/robots?instance=one&mode=imprenta', '/robots', '/robots?mode=imprenta&view=instances'],
  [false, '/robots?instance=one', '/robots', '/robots'],
  [true, '/robots?instance=one&artifact=true', '/robots', '/robots'],
  [true, '/robots?instance=one', '/robots?instance=two', '/robots?instance=two'],
  [true, '/robots?instance=one&mode=workflow', '/robots?view=instances', '/robots?view=instances'],
  [true, '/leads/one', '/leads', '/leads'],
])('breadcrumb navigation mobile=%s from %s to %s', (mobile, current, target, expected) => {
  const originalMatchMedia = window.matchMedia
  window.matchMedia = jest.fn().mockReturnValue({ matches: mobile })
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  const [path, query] = current.split('?')
  jest.mocked(usePathname).mockReturnValue(path)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
  try {
    const hook = renderHook(() => useNavigationHistory())
    act(() => hook.result.current.navigateTo({ path: target, label: 'Parent', timestamp: 1 }))
    expect(push).toHaveBeenCalledWith(expected)
  } finally {
    window.matchMedia = originalMatchMedia
  }
})

test.each([
  ['/leads?view=table', '/chat?conversationId=one'],
  ['/robots?mode=workflow&view=instances', '/robots?mode=workflow&instance=one'],
  ['/control-center?view=calendar', '/control-center/one?title=Task'],
])('clicking the recorded origin returns from %s through %s and restores the original URL', (origin, detail) => {
  const push = jest.fn()
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  setRoute(origin)
  const hook = renderHook(() => useNavigationHistory())
  setRoute(detail)
  hook.rerender()
  expect(hook.result.current.items.map(item => item.path)).toEqual([origin, detail])
  act(() => hook.result.current.navigateTo(hook.result.current.items[0]))
  expect(push).toHaveBeenCalledWith(origin)
})

test('does not return a direct conversation link to an unrelated stored trail', () => {
  localStorage.setItem('navigationHistory', JSON.stringify({ items: [
    { path: '/control-center?view=calendar', label: 'Tasks', timestamp: 1 },
  ] }))
  setRoute('/chat?conversationId=one&title=50%25+off')
  const hook = renderHook(() => useNavigationHistory())
  expect(hook.result.current.items.map(item => item.path)).toEqual(['/chat', '/chat?conversationId=one&title=50%25+off'])
  expect(hook.result.current.items[1].label).toBe('50% off')
})