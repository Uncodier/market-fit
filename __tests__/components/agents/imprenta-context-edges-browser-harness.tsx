import { useLayoutEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"
import { ImprentaContextEdgesCanvas } from "@/app/components/agents/imprenta-context-edges-canvas"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"
import { createImprentaHoverStore } from "@/app/lib/imprenta-hover-store"
import { createImprentaDragStore } from "@/app/lib/imprenta-drag-store"
import type { InstanceNode } from "@/app/types/instance-nodes"

function mountHarness() {
  const root = createRoot(document.getElementById("root")!)
  const viewportStore = createViewportStore({ canvasWidth: 800, canvasHeight: 600, position: { x: 400, y: 300 } })
  const hoverStore = createImprentaHoverStore()
  const dragStore = createImprentaDragStore()
  const nodes: InstanceNode[] = []
  const positions: Record<string, { x: number; y: number }> = {}
  const nodeHeights = {}
  const contexts = Array.from({ length: 151 }, (_, i) => {
    const source = `source-${i}`, target = `target-${i}`
    nodes.push({ id: source, type: "prompt" } as InstanceNode, { id: target, type: "prompt" } as InstanceNode)
    // The first curve crosses the viewport with endpoints offscreen at every zoom.
    // Others make hit-testing visit a realistic 151-relation scene without ambiguity.
    const y = i === 0 ? -150 : 1_000_000 + i * 1000
    positions[source] = { x: -1_000_480, y }
    positions[target] = { x: 1_000_000, y }
    return { id: `edge-${i}`, context_node_id: source, target_node_id: target, type: "reference" }
  })
  const paints = { static: 0, highlight: 0 }
  const selections: { id: string | null; anchor?: { x: number; y: number } }[] = []
  let commits = 0, nodeHits = 0, controlHits = 0, panStarts = 0
  const originalClear = CanvasRenderingContext2D.prototype.clearRect
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    const layer = this.canvas.dataset.imprentaContextEdges as keyof typeof paints | undefined
    if (layer) paints[layer]++
    return originalClear.apply(this, args)
  }
  function Harness() {
    const [selectedContextId, setSelected] = useState<string | null>(null)
    useLayoutEffect(() => { commits++ })
    return <div id="viewport" style={{ isolation: "isolate", position: "relative", width: 800, height: 600 }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        <ImprentaContextEdgesCanvas contexts={contexts} nodes={nodes} positions={positions} nodeHeights={nodeHeights}
          selectedContextId={selectedContextId} onSelectContext={(id, anchor) => { selections.push({ id, anchor }); setSelected(id) }}
          viewportStore={viewportStore} hoverStore={hoverStore} dragStore={dragStore} />
      </div>
      <div data-node-id="dom-card" id="card" style={{ position: "absolute", left: 40, top: 275, width: 100, height: 50, zIndex: 2 }}>
        <button id="control" onClick={() => { controlHits++ }}>Control</button>
      </div>
      <div data-imprenta-context-control id="relation-control" style={{ position: "absolute", left: 180, top: 280, width: 60, height: 40, zIndex: 2 }}>Relation</div>
    </div>
  }
  flushSync(() => root.render(<Harness />))
  const viewport = document.getElementById("viewport")!
  // Registered after edges deliberately; node precedence cannot depend on order.
  viewport.addEventListener("pointerdown", event => {
    const rect = viewport.getBoundingClientRect()
    const x = event.clientX - rect.left, y = event.clientY - rect.top
    if (x >= 600 && x <= 680 && y >= 280 && y <= 320) { nodeHits++; event.preventDefault() }
  })
  viewport.addEventListener("mousedown", () => { panStarts++ })
  const pixels = () => {
    const base = document.querySelector<HTMLCanvasElement>('[data-imprenta-context-edges="static"]')!
    const dpr = base.width / 800
    const image = base.getContext("2d")!.getImageData(390 * dpr, 297 * dpr, 20 * dpr, 6 * dpr)
    return [...image.data].filter((_, i) => i % 4 === 3).some(alpha => alpha > 0)
  }
  return {
    zoom: (scale: number) => viewportStore.set({ scale }),
    hover: (id: string | null) => hoverStore.set(id),
    pan: (x: number, y: number) => viewportStore.set({ position: { x, y } }),
    drag: (x: number, y: number) => dragStore.set({ id: "source-0", x, y }),
    endDrag: () => dragStore.set(null),
    snapshot: () => ({ paints: { ...paints }, commits, selections: [...selections], nodeHits, controlHits, panStarts, pixels: pixels(),
      bitmaps: Array.from(document.querySelectorAll("canvas")).map(c => [c.width, c.height]),
    }),
    dispose: () => { root.unmount(); CanvasRenderingContext2D.prototype.clearRect = originalClear },
  }
}

export type ContextEdgesBrowserHarness = ReturnType<typeof mountHarness>
declare global { interface Window { contextEdgesTest: ContextEdgesBrowserHarness } }
window.contextEdgesTest = mountHarness()