import { createRef, StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { useBrowserWorkspace } from '@/app/robots/use-browser-workspace'
import { useBrowserPresentation } from '@/app/robots/use-browser-presentation'

jest.mock('@/app/components/simple-messages-view/hooks/useRequirementStatus', () => ({
  useRequirementStatus: () => ({ requirementStatuses: [], isLoading: true, isValidating: true }),
}))
jest.mock('@/app/components/simple-messages-view/hooks/useInstanceArtifacts', () => ({
  useInstanceArtifacts: () => ({ artifacts: [], isLoading: true }),
}))

type Input = Parameters<typeof useBrowserWorkspace>[0]
function input(id: string): Input {
  return {
    currentSite: { id: 'site-a' }, activeRobotInstance: { id, site_id: 'site-a' },
    searchParams: new URLSearchParams(), theme: 'dark', pendingInstanceId: null,
    isCanvasMode: false, iframeRef: createRef<HTMLIFrameElement>(),
    containerRef: createRef<HTMLDivElement>(), viewportSize: 'imac', setScale: jest.fn(),
  } as unknown as Input
}

describe('Robots browser presentation event dependencies', () => {
  it('toggles both desktop and mobile selections with pure updates, rebinds after selection changes, and cleans up', () => {
    localStorage.clear()
    const remove = jest.spyOn(window, 'removeEventListener')
    const view = renderHook((base: Input) => useBrowserPresentation(useBrowserWorkspace(base)), {
      initialProps: input('a'), wrapper: StrictMode,
    })
    act(() => window.dispatchEvent(new Event('robot:toggle-source-code')))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.mobileWorkspaceTab).toBe('source')
    act(() => window.dispatchEvent(new Event('robot:toggle-source-code')))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'preview' })
    expect(view.result.current.mobileWorkspaceTab).toBe('preview')
    view.rerender(input('b'))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'preview' })
    act(() => window.dispatchEvent(new Event('robot:toggle-source-code')))
    expect(view.result.current.activeBrowserTab).toEqual({ kind: 'source' })
    expect(view.result.current.mobileWorkspaceTab).toBe('source')
    view.unmount()
    expect(remove).toHaveBeenCalledWith('robot:toggle-source-code', expect.any(Function))
    act(() => window.dispatchEvent(new Event('robot:toggle-source-code')))
    remove.mockRestore()
  })
})