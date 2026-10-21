import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useBrowserWorkspace } from '@/app/robots/use-browser-workspace'
import { useRequirementStatus } from '@/app/components/simple-messages-view/hooks/useRequirementStatus'
import { useInstanceArtifacts } from '@/app/components/simple-messages-view/hooks/useInstanceArtifacts'
import type { InstanceArtifact } from '@/app/components/simple-messages-view/types'
import { instanceWorkspaceStorageKey, saveInstanceWorkspaceState } from '@/app/robots/instance-workspace-state'

jest.mock('@/app/components/simple-messages-view/hooks/useRequirementStatus', () => ({ useRequirementStatus: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/hooks/useInstanceArtifacts', () => ({ useInstanceArtifacts: jest.fn() }))

type Input = Parameters<typeof useBrowserWorkspace>[0]
function input(id: string | null = 'a', site = 'site-a', query = ''): Input {
  return {
    activeRobotInstance: id ? { id, site_id: site, status: 'running' } : null,
    currentSite: { id: site }, searchParams: new URLSearchParams(query),
  } as unknown as Input
}
function artifact(screen: string, id = screen, time = 1, instance = 'a', site = 'site-a'): InstanceArtifact {
  return {
    id, screen, instance_id: instance, site_id: site, url: `https://example.com/${id}`,
    created_at: new Date(time * 1000).toISOString(), should_reload: false,
    user_id: null, title: null, description: null, context: {},
  }
}
const readStatus = jest.mocked(useRequirementStatus)
const readArtifacts = jest.mocked(useInstanceArtifacts)
const refetchArtifacts = jest.fn()
const removeArtifactLocally = jest.fn()
let artifacts: InstanceArtifact[]
let artifactsLoading: boolean
let previewKnown: boolean
let statuses: Array<{ instance_id: string; site_id: string; preview_url?: string; source_code?: string }>

beforeEach(() => {
  localStorage.clear()
  artifacts = []
  artifactsLoading = false
  previewKnown = false
  statuses = []
  readArtifacts.mockImplementation(() => ({ artifacts, isLoading: artifactsLoading, refetchArtifacts, removeArtifactLocally }))
  readStatus.mockImplementation(() => ({ requirementStatuses: statuses, isLoading: !previewKnown, isValidating: !previewKnown, loadStatuses: jest.fn() }))
})

describe('Robots browser workspace render lifecycle', () => {
  it('mounts with fresh empty read arrays in StrictMode without a render loop', () => {
    readArtifacts.mockImplementation(() => ({ artifacts: [], isLoading: true, refetchArtifacts, removeArtifactLocally }))
    readStatus.mockImplementation(() => ({ requirementStatuses: [], isLoading: true, isValidating: true, loadStatuses: jest.fn() }))
    const view = renderHook(useBrowserWorkspace, { initialProps: input(), wrapper: StrictMode })
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'preview' })
    view.rerender(input())
    expect(readArtifacts.mock.calls.length).toBeLessThan(12)
    expect(view.result.current.artifactReloadCounter).toBe(0)
  })

  it('restores saved layout and tab before loading and does not overwrite them with defaults', () => {
    const saved = { activeBrowserTab: { kind: 'artifact' as const, screen: 'orders' }, layout: 'chat' as const }
    saveInstanceWorkspaceState('a', saved)
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    expect(view.result.current.activeBrowserTab).toEqual(saved.activeBrowserTab)
    expect(view.result.current.workspaceLayout).toBe('chat')
    expect(JSON.parse(localStorage.getItem(instanceWorkspaceStorageKey('a'))!)).toEqual(saved)
    artifactsLoading = true
    view.rerender(input())
    artifacts = [artifact('catalog'), artifact('orders', 'older', 0)]
    artifactsLoading = false
    previewKnown = true
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual(saved.activeBrowserTab)
    expect(view.result.current.mobileWorkspaceTab).toBe('agent')
    expect(view.result.current.refetchArtifacts).toBe(refetchArtifacts)
    expect(view.result.current.removeArtifactLocally).toBe(removeArtifactLocally)
  })

  it.each(['code', 'source_code', 'source'])('gives %s URL selection priority over saved workspace', screen => {
    saveInstanceWorkspaceState('a', { activeBrowserTab: { kind: 'artifact', screen: 'orders' }, layout: 'chat' })
    statuses = [{ instance_id: 'a', site_id: 'site-a', source_code: 'https://example.com/source.zip' }]
    previewKnown = true
    artifacts = [artifact('orders')]
    const view = renderHook(useBrowserWorkspace, { initialProps: input('a', 'site-a', `artifact=true&screen=${screen}`) })
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.mobileWorkspaceTab).toBe('source')
    expect(view.result.current.workspaceLayout).toBe('split')
    act(() => view.result.current.setActiveBrowserTab({ kind: 'preview' }))
    view.rerender(input('a', 'site-a', 'tab=source'))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'preview' })
  })

  it('retains saved source/database choices on initial artifacts with a requirement preview', () => {
    statuses = [{ instance_id: 'a', site_id: 'site-a', preview_url: 'https://example.com/preview' }]
    previewKnown = true
    artifacts = [artifact('orders')]
    saveInstanceWorkspaceState('a', { activeBrowserTab: { kind: 'artifact', screen: 'database' }, layout: 'preview' })
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'artifact', screen: 'database' })
    expect(view.result.current.workspaceLayout).toBe('preview')
    expect(view.result.current.latestPreviewUrl).toBe('https://example.com/preview')
  })

  it('waits for preview status before initial artifact fallback and retains delayed source selection', () => {
    artifacts = [artifact('orders')]
    const view = renderHook(useBrowserWorkspace, { initialProps: input('a', 'site-a', 'tab=source') })
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    statuses = [{ instance_id: 'a', site_id: 'site-a', source_code: 'https://example.com/source.zip' }]
    previewKnown = true
    view.rerender(input('a', 'site-a', 'tab=source'))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.artifactReloadCounter).toBe(0)
  })

  it('falls back from an unavailable saved artifact after a settled load', () => {
    saveInstanceWorkspaceState('a', { activeBrowserTab: { kind: 'artifact', screen: 'removed' }, layout: 'chat' })
    artifactsLoading = true
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    artifactsLoading = false
    previewKnown = true
    artifacts = [artifact('orders')]
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'artifact', screen: 'orders' })
    expect(view.result.current.workspaceLayout).toBe('chat')
    artifacts = []
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'preview' })
  })

  it('selects a first artifact arriving after known absence and reloads only once per read snapshot', () => {
    previewKnown = true
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    artifacts = [{ ...artifact('orders'), should_reload: true }]
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'artifact', screen: 'orders' })
    expect(view.result.current.mobileWorkspaceTab).toBe('artifact-orders')
    expect(view.result.current.artifactReloadCounter).toBe(1)
    view.rerender(input())
    act(() => {
      view.result.current.setWorkspaceLayout('chat')
      view.result.current.setMobileWorkspaceTab('agent')
    })
    expect(view.result.current.artifactReloadCounter).toBe(1)
    // A visibility refetch returns a fresh read snapshot; should_reload retains
    // its deliberate same-timestamp reload behavior without a render loop.
    artifacts = artifacts.map(row => ({ ...row }))
    view.rerender(input())
    expect(view.result.current.artifactReloadCounter).toBe(2)
    view.rerender(input())
    expect(view.result.current.artifactReloadCounter).toBe(2)
  })

  it('preserves explicit user choices until a genuinely newer artifact arrives', () => {
    previewKnown = true
    statuses = [{ instance_id: 'a', site_id: 'site-a', preview_url: 'https://example.com/preview' }]
    artifacts = [artifact('orders')]
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    act(() => view.result.current.setActiveBrowserTab({ kind: 'source' }))
    artifacts = [...artifacts]
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    artifacts = [{ ...artifact('catalog', 'new', 2), should_reload: true }, ...artifacts]
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'artifact', screen: 'catalog' })
    expect(view.result.current.artifactReloadCounter).toBe(1)
    act(() => view.result.current.setActiveBrowserTab({ kind: 'source' }))
    view.rerender(input())
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.artifactReloadCounter).toBe(1)
  })

  it('isolates instance and site changes, ignores old read rows and stale event setters, and restores return visits', () => {
    previewKnown = true
    artifacts = [artifact('orders')]
    const view = renderHook(useBrowserWorkspace, { initialProps: input() })
    act(() => view.result.current.setWorkspaceLayout('chat'))
    const oldSetter = view.result.current.setActiveBrowserTab
    saveInstanceWorkspaceState('b', { activeBrowserTab: { kind: 'source' }, layout: 'preview' })
    view.rerender(input('b'))
    expect(view.result.current.artifacts).toEqual([])
    expect(view.result.current.latestPreviewUrl).toBeNull()
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.workspaceLayout).toBe('preview')
    act(() => oldSetter({ kind: 'artifact', screen: 'orders' }))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    view.rerender(input('a'))
    expect(view.result.current.workspaceLayout).toBe('chat')
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'artifact', screen: 'orders' })
    view.rerender({ ...input(), currentSite: { id: 'site-b' } } as Input)
    expect(view.result.current.artifacts).toEqual([])
    expect(view.result.current.workspaceLayout).toBe('split')
    expect(readArtifacts.mock.calls.at(-1)?.[0]).toEqual({ instanceId: undefined })
    expect(readStatus.mock.calls.at(-1)?.[0]).toBeNull()
    view.rerender(input(null, 'site-b'))
    expect(view.result.current.artifactReloadCounter).toBe(0)
  })
})