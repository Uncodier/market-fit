import React, { useLayoutEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { useMessageScroll, useMessageScrollEffects } from '../../../app/components/simple-messages-view/use-message-scroll'
import type { InstanceLog } from '../../../app/components/simple-messages-view/types'

const activeRobotInstance = { id: 'offline-scroll-robot', status: 'completed' }
const noOp = () => {}
const noHistory = async () => { throw new Error('History is outside this offline harness') }
const log = (index: number): InstanceLog => ({
  id: `offline-log-${index}`, log_type: 'agent_action', level: 'info',
  message: `Offline message ${index}`, created_at: '2026-10-27T10:00:00Z',
})

function mountHarness() {
  const root = createRoot(document.getElementById('root')!)
  let renderAgain = noOp
  let appendLog = noOp
  let commits = 0
  let frame = 0
  let streaming = false
  const wheelDeltas: number[] = []

  function Harness() {
    const [revision, setRevision] = useState(0)
    const [logs, setLogs] = useState(() => Array.from({ length: 30 }, (_, i) => log(i)))
    const scroll = useMessageScroll(activeRobotInstance, noOp)
    const { handleScroll } = useMessageScrollEffects({
      ...scroll, activeRobotInstance, logs, isLoadingLogs: false,
      isLoadingPlans: false, isLoadingMore: false, hasMoreLogs: false,
      loadMoreLogs: noHistory,
    })
    useLayoutEffect(() => {
      commits++
      renderAgain = () => flushSync(() => setRevision(value => value + 1))
      appendLog = () => flushSync(() => setLogs(value => [...value, log(value.length)]))
    })

    return <main data-revision={revision}>
      <div id="messages" ref={scroll.messagesContainerRef} onScroll={handleScroll}>
        <div id="timeline">
          {logs.map(entry => <div className="message" key={entry.id} data-timeline-item-id={entry.id}>
            {entry.message}
          </div>)}
          <div id="async-content" />
          <div ref={scroll.messagesEndRef} />
          <div style={{ height: scroll.bottomPadding }} />
        </div>
      </div>
      <div id="composer" ref={scroll.bottomContainerRef}>
        <button id="latest" onClick={scroll.jumpToLatestLogs}
          style={{ visibility: scroll.showJumpToLatest ? 'visible' : 'hidden' }}
          disabled={!scroll.showJumpToLatest}>Latest</button>
        <div>Offline composer</div>
      </div>
    </main>
  }

  flushSync(() => root.render(<Harness />))
  const container = document.getElementById('messages')!
  container.addEventListener('wheel', event => {
    if (event.isTrusted) wheelDeltas.push(event.deltaY)
  }, { passive: true })
  const snapshot = () => ({
    top: container.scrollTop,
    height: container.scrollHeight,
    viewport: container.clientHeight,
    gap: container.scrollHeight - container.clientHeight - container.scrollTop,
    latest: getComputedStyle(document.getElementById('latest')!).visibility === 'visible',
    commits,
    wheelDeltas: [...wheelDeltas],
  })
  const tick = () => {
    if (!streaming) return
    renderAgain()
    frame = requestAnimationFrame(tick)
  }
  return {
    snapshot,
    rerender: () => renderAgain(),
    append: () => appendLog(),
    startRerenders: () => { streaming = true; frame = requestAnimationFrame(tick) },
    stopRerenders: () => { streaming = false; cancelAnimationFrame(frame) },
    // Change layout on a later task, with no React state update or network resource.
    growAsync: (pixels: number) => new Promise<void>(resolve => {
      setTimeout(() => {
        const content = document.getElementById('async-content')!
        content.style.height = `${content.getBoundingClientRect().height + pixels}px`
        resolve()
      }, 20)
    }),
    dispose: () => { streaming = false; cancelAnimationFrame(frame); root.unmount() },
  }
}

export type MessageScrollBrowserHarness = ReturnType<typeof mountHarness>
declare global { interface Window { messageScrollTest: MessageScrollBrowserHarness } }
window.messageScrollTest = mountHarness()