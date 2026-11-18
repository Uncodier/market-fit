interface CanvasPointerInteraction {
  enabled: () => boolean
  hitTest: (clientX: number, clientY: number) => string | null
  onNodePointerDown: (id: string, event: PointerEvent) => void
  onBackgroundPointerDown: (event: PointerEvent) => void
}

const DOM_INTERACTION = [
  "[data-node-id]", "[data-imprenta-context-control]", "button", "input", "textarea", "select", "a", "label",
  "[contenteditable]:not([contenteditable=false])", "[tabindex]",
  ...["button", "tab", "tablist", "menuitem", "menu", "dialog", "listbox", "option", "combobox", "slider", "checkbox", "switch"]
    .map((role) => `[role="${role}"]`),
].join(",")

/** ZoomableCanvas's isolated inner viewport owns both transformed cards and the
 * screenSpaceFront wrapper. Fall back to the parent for standalone consumers. */
function sharedViewport(canvas: HTMLCanvasElement): HTMLElement {
  let ancestor = canvas.parentElement
  while (ancestor) {
    if (ancestor.style.isolation === "isolate") return ancestor
    ancestor = ancestor.parentElement
  }
  return canvas.parentElement ?? canvas
}

/** Paint is pointer-transparent. Delegate on the shared viewport, never document,
 * so DOM cards/controls keep their native targets and background pan still bubbles. */
export function bindCanvasPointerInteraction(canvas: HTMLCanvasElement, interaction: CanvasPointerInteraction) {
  const viewport = sharedViewport(canvas)
  const originalCursor = viewport.style.cursor
  let frame: number | null = null
  let lastX = 0
  let lastY = 0
  let ownsCursor = false
  const restoreCursor = () => {
    if (ownsCursor) viewport.style.cursor = originalCursor
    ownsCursor = false
  }
  const ignore = (event: PointerEvent) => {
    if (event.defaultPrevented || !interaction.enabled()) return true
    // Only inspect descendants: the viewport may itself be inside a tab panel
    // or another interactive container that does not own this canvas gesture.
    for (const target of event.composedPath()) {
      if (target === viewport) break
      if (target instanceof Element && target.matches(DOM_INTERACTION)) return true
    }
    return false
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || ignore(event)) return
    const id = interaction.hitTest(event.clientX, event.clientY)
    if (id !== null) interaction.onNodePointerDown(id, event)
    else interaction.onBackgroundPointerDown(event)
    // The node callback may preventDefault to suppress compatibility mousedown
    // (and thus viewport pan). Empty-space events must remain untouched here.
  }
  const cancelCursor = () => {
    if (frame !== null) window.cancelAnimationFrame(frame)
    frame = null
    restoreCursor()
  }
  const onPointerMove = (event: PointerEvent) => {
    if (ignore(event) || event.buttons !== 0) {
      cancelCursor()
      return
    }
    lastX = event.clientX
    lastY = event.clientY
    if (frame !== null) return
    frame = window.requestAnimationFrame(() => {
      frame = null
      if (interaction.enabled() && interaction.hitTest(lastX, lastY) !== null) {
        viewport.style.cursor = "grab"
        ownsCursor = true
      } else restoreCursor()
    })
  }
  // Bubble phase permits descendant native handlers to decline the gesture.
  // Direct synthetic canvas events also reach this listener exactly once.
  viewport.addEventListener("pointerdown", onPointerDown)
  viewport.addEventListener("pointermove", onPointerMove)
  viewport.addEventListener("pointerleave", cancelCursor)
  return () => {
    viewport.removeEventListener("pointerdown", onPointerDown)
    viewport.removeEventListener("pointermove", onPointerMove)
    viewport.removeEventListener("pointerleave", cancelCursor)
    cancelCursor()
  }
}