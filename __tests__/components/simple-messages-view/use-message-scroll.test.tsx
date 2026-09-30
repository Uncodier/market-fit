import React, { useCallback, useLayoutEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useMessageScroll, useMessageScrollEffects } from '@/app/components/simple-messages-view/use-message-scroll'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

const log = (id: string): InstanceLog => ({
  id, log_type: 'agent_action', level: 'info', message: id,
  created_at: '2026-09-30T10:00:00Z',
})

interface HarnessProps {
  instanceId?: string
  logs?: InstanceLog[]
  loading?: boolean
  loadingPlans?: boolean
  loadingMore?: boolean
  hasMore?: boolean
  height?: number
  viewport?: number
  loadMore?: () => Promise<void>
  onLayout?: (top: number) => void
  rowOffsets?: Record<string, number>
}

const noOp = () => {}
const noLoad = async () => {}
const initialLogs = [log('latest')]

function Harness({ instanceId = 'robot-a', logs = initialLogs, loading = false,
  loadingPlans = false, loadingMore = false, hasMore = true, height = 2000,
  viewport = 500, loadMore = noLoad, onLayout = noOp, rowOffsets }: HarnessProps) {
  const activeRobotInstance = { id: instanceId, status: 'completed' }
  const scroll = useMessageScroll(activeRobotInstance, noOp)
  const { messagesContainerRef, bottomContainerRef, showJumpToLatest, jumpToLatestLogs } = scroll
  const { handleScroll } = useMessageScrollEffects({
    ...scroll, activeRobotInstance, logs, isLoadingLogs: loading,
    isLoadingPlans: loadingPlans, isLoadingMore: loadingMore,
    hasMoreLogs: hasMore, loadMoreLogs: loadMore,
  })
  const attachContainer = useCallback((node: HTMLDivElement | null) => {
    messagesContainerRef.current = node
    if (!node) return
    let top = node.scrollTop
    Object.defineProperties(node, {
      scrollHeight: { configurable: true, get: () => height },
      clientHeight: { configurable: true, get: () => viewport },
      scrollTop: {
        configurable: true, get: () => top,
        set: (value: number) => { top = Math.max(0, Math.min(value, node.scrollHeight - node.clientHeight)) },
      },
    })
    node.scrollTo = (options?: ScrollToOptions | number, y?: number) => {
      node.scrollTop = typeof options === 'number' ? y ?? 0 : options?.top ?? 0
    }
  }, [messagesContainerRef, height, viewport])

  useLayoutEffect(() => {
    if (!loading) onLayout(scroll.messagesContainerRef.current?.scrollTop ?? -1)
  })

  return <>
    {!loading && <div data-testid="messages" ref={attachContainer} onScroll={handleScroll}>
      <div>{logs.map(entry => <p key={entry.id}
        data-timeline-item-id={rowOffsets ? entry.id : undefined}
        ref={node => {
          if (!node || !rowOffsets) return
          node.getBoundingClientRect = () => ({
            top: rowOffsets[entry.id] - (messagesContainerRef.current?.scrollTop ?? 0),
            bottom: rowOffsets[entry.id] + 40 - (messagesContainerRef.current?.scrollTop ?? 0),
          } as DOMRect)
        }}
      >{entry.message}</p>)}</div>
    </div>}
    {!loading && <div ref={bottomContainerRef} data-testid="composer" />}
    {showJumpToLatest && <button onClick={jumpToLatestLogs}>Latest</button>}
  </>
}

function moveTo(top: number) {
  const container = screen.getByTestId('messages')
  container.scrollTop = top
  fireEvent.scroll(container)
  return container
}

describe('robot message scroll', () => {
  const originalResizeObserver = globalThis.ResizeObserver
  let observers: Array<{ callback: ResizeObserverCallback; targets: Set<Element>; observer: ResizeObserver }>

  function resize(target: Element) {
    act(() => {
      for (const item of observers) {
        if (item.targets.has(target)) item.callback([{ target } as ResizeObserverEntry], item.observer)
      }
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
    observers = []
    globalThis.ResizeObserver = class {
      targets = new Set<Element>()
      constructor(callback: ResizeObserverCallback) {
        observers.push({ callback, targets: this.targets, observer: this })
      }
      observe(target: Element) { this.targets.add(target) }
      unobserve(target: Element) { this.targets.delete(target) }
      disconnect() { this.targets.clear() }
    }
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    globalThis.ResizeObserver = originalResizeObserver
  })

  it('lands on the latest cached logs before paint, including instance switches', () => {
    const onLayout = jest.fn()
    const { rerender } = render(<Harness onLayout={onLayout} />)
    expect(onLayout.mock.calls[0]).toEqual([1500])

    moveTo(600)
    expect(screen.getByRole('button', { name: 'Latest' })).toBeInTheDocument()
    onLayout.mockClear()
    rerender(<Harness instanceId="robot-b" onLayout={onLayout} />)
    expect(onLayout.mock.calls[0]).toEqual([1500])
    expect(screen.queryByRole('button', { name: 'Latest' })).not.toBeInTheDocument()
  })

  it('does not let delayed initial or plan loading snaps override an upward scroll', () => {
    const { rerender } = render(<Harness loading loadingPlans />)
    rerender(<Harness loadingPlans />)
    expect(screen.getByTestId('messages').scrollTop).toBe(1500)
    moveTo(700)
    rerender(<Harness />)
    act(() => { jest.advanceTimersByTime(250) })
    expect(screen.getByTestId('messages').scrollTop).toBe(700)
  })

  it('never fetches history for initial, stationary, or downward scroll events', async () => {
    const loadMore = jest.fn().mockResolvedValue(undefined)
    render(<Harness height={550} loadMore={loadMore} />)
    fireEvent.scroll(screen.getByTestId('messages'))
    expect(loadMore).not.toHaveBeenCalled()

    moveTo(20)
    expect(loadMore).toHaveBeenCalledTimes(1)
    await act(async () => { jest.advanceTimersByTime(100) })
    loadMore.mockClear()
    moveTo(30)
    fireEvent.scroll(screen.getByTestId('messages'))
    expect(loadMore).not.toHaveBeenCalled()
  })

  it('requests one older page near the top and preserves the view when it is prepended', async () => {
    let resolvePage!: () => void
    const loadMore = jest.fn(() => new Promise<void>(resolve => { resolvePage = resolve }))
    const { rerender } = render(<Harness loadMore={loadMore} />)
    moveTo(300)
    expect(loadMore).not.toHaveBeenCalled()
    moveTo(80)
    moveTo(60)
    expect(loadMore).toHaveBeenCalledTimes(1)

    // Simulate the DOM growing before the layout effects of the prepend commit.
    const container = screen.getByTestId('messages')
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2600 })
    await act(async () => {
      resolvePage()
      rerender(<Harness logs={[log('older'), ...initialLogs]} loadMore={loadMore} />)
    })
    expect(container.scrollTop).toBe(660)
    fireEvent.scroll(container)
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('ignores a pending history response after switching instances', async () => {
    let resolvePage!: () => void
    const loadMore = jest.fn(() => new Promise<void>(resolve => { resolvePage = resolve }))
    const { rerender } = render(<Harness loadMore={loadMore} />)
    moveTo(80)
    rerender(<Harness instanceId="robot-b" loadMore={loadMore} />)
    moveTo(500)
    Object.defineProperty(screen.getByTestId('messages'), 'scrollHeight', { configurable: true, value: 3000 })
    await act(async () => { resolvePage() })
    act(() => { jest.advanceTimersByTime(250) })
    expect(screen.getByTestId('messages').scrollTop).toBe(500)
  })

  it('follows new logs only at the bottom and resumes following through Latest', () => {
    const { rerender } = render(<Harness />)
    const container = moveTo(800)
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2400 })
    rerender(<Harness logs={[...initialLogs, log('new')]} />)
    act(() => { jest.advanceTimersByTime(250) })
    expect(container.scrollTop).toBe(800)

    fireEvent.click(screen.getByRole('button', { name: 'Latest' }))
    expect(container.scrollTop).toBe(1900)
    expect(screen.queryByRole('button', { name: 'Latest' })).not.toBeInTheDocument()
  })

  it('does not paginate once there are no older logs', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined)
    render(<Harness hasMore={false} loadMore={loadMore} />)
    moveTo(0)
    expect(loadMore).not.toHaveBeenCalled()
  })

  it('still detects upward movement when a render or resize precedes the scroll event', async () => {
    const loadMore = jest.fn().mockResolvedValue(undefined)
    const { rerender } = render(<Harness loadMore={loadMore} />)
    const container = moveTo(300)
    container.scrollTop = 0
    rerender(<Harness logs={[...initialLogs, log('new')]} loadMore={loadMore} />)
    resize(container)
    fireEvent.scroll(container)
    expect(loadMore).toHaveBeenCalledTimes(1)
    await act(async () => {})
  })

  it('anchors the visible row through loading transitions and simultaneous tail growth', async () => {
    let resolvePage!: () => void
    const loadMore = jest.fn(() => new Promise<void>(resolve => { resolvePage = resolve }))
    const { rerender } = render(<Harness loadMore={loadMore} rowOffsets={{ latest: 200 }} />)
    const container = moveTo(80)
    rerender(<Harness loadMore={loadMore} loadingMore rowOffsets={{ latest: 200 }} />)
    moveTo(60)
    expect(loadMore).toHaveBeenCalledTimes(1)

    // Tail growth must not count as prepended history when restoring the viewport.
    const nextLogs = [log('older'), ...initialLogs, log('new')]
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 3000 })
    rerender(<Harness logs={nextLogs} loadingMore loadMore={loadMore}
      rowOffsets={{ older: 200, latest: 800, new: 2400 }} />)
    expect(container.scrollTop).toBe(60)
    await act(async () => {
      resolvePage()
      rerender(<Harness logs={nextLogs} loadMore={loadMore}
        rowOffsets={{ older: 200, latest: 800, new: 2400 }} />)
    })
    expect(container.scrollTop).toBe(660)
    expect(screen.getByText('latest').getBoundingClientRect().top).toBe(140)
    fireEvent.scroll(container)
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('follows asynchronous content and composer resizing only while pinned', () => {
    const loadMore = jest.fn().mockResolvedValue(undefined)
    render(<Harness loadMore={loadMore} />)
    const container = screen.getByTestId('messages')
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2400 })
    resize(container.firstElementChild!)
    expect(container.scrollTop).toBe(1900)
    fireEvent.scroll(container)
    expect(loadMore).not.toHaveBeenCalled()

    moveTo(600)
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 2800 })
    resize(container.firstElementChild!)
    resize(screen.getByTestId('composer'))
    expect(container.scrollTop).toBe(600)
    fireEvent.click(screen.getByRole('button', { name: 'Latest' }))
    expect(container.scrollTop).toBe(2300)
  })

  it('reconnects resize observers after loading and cleans them up on instance changes', () => {
    const { rerender, unmount } = render(<Harness loading />)
    expect(observers).toHaveLength(0)
    rerender(<Harness />)
    const firstObservers = [...observers]
    expect(firstObservers).toHaveLength(2)
    rerender(<Harness instanceId="robot-b" />)
    expect(firstObservers.every(item => item.targets.size === 0)).toBe(true)
    expect(observers.slice(2).every(item => item.targets.size > 0)).toBe(true)
    unmount()
    expect(observers.every(item => item.targets.size === 0)).toBe(true)
  })
})