interface ContextEdgeInteraction {
  enabled: () => boolean
  hitTest: (clientX: number, clientY: number) => string | null
  onSelect: (id: string, anchor: { x: number; y: number }) => void
}

const DOM_INTERACTION = [
  "[data-node-id]", "[data-imprenta-context-control]", "button", "input", "textarea", "select", "a", "label",
  "[contenteditable]:not([contenteditable=false])", "[tabindex]",
  ...["button", "tab", "tablist", "menuitem", "menu", "dialog", "listbox", "option", "combobox", "slider", "checkbox", "switch"]
    .map(role => `[role="${role}"]`),
].join(",")

function sharedViewport(canvas: HTMLCanvasElement): HTMLElement {
  let ancestor = canvas.parentElement
  while (ancestor) {
    if (ancestor.style.isolation === "isolate") return ancestor
    ancestor = ancestor.parentElement
  }
  return canvas.parentElement ?? canvas
}

/** No pointer capture or prevention on down: cards/nodes/pan own that gesture.
 * Keep the native down event until click, so a later-registered node listener's
 * preventDefault also wins. Capture would run too early to respect that owner. */
export function bindContextEdgeInteraction(canvas: HTMLCanvasElement, interaction: ContextEdgeInteraction) {
  const viewport = sharedViewport(canvas)
  let active: { event: PointerEvent; id: string; moved: boolean; released: boolean } | null = null
  const ignored = (event: Event) => {
    if (event.defaultPrevented || !interaction.enabled()) return true
    for (const target of event.composedPath()) {
      if (target === viewport) break
      if (target instanceof Element && target.matches(DOM_INTERACTION)) return true
    }
    return false
  }
  const cancel = () => { active = null }
  const onDown = (event: PointerEvent) => {
    cancel()
    if (event.button !== 0 || event.isPrimary === false || ignored(event)) return
    const id = interaction.hitTest(event.clientX, event.clientY)
    if (id) active = { event, id, moved: false, released: false }
  }
  const trackMovement = (event: PointerEvent) => {
    if (!active || event.pointerId !== active.event.pointerId) return
    if (Math.hypot(event.clientX - active.event.clientX, event.clientY - active.event.clientY) > 5) active.moved = true
  }
  const onUp = (event: PointerEvent) => {
    trackMovement(event)
    if (active && event.pointerId === active.event.pointerId) active.released = true
  }
  const onClick = (event: MouseEvent) => {
    const gesture = active
    cancel()
    if (!gesture || !gesture.released || gesture.moved || gesture.event.defaultPrevented || ignored(event) || event.button !== 0) return
    if (Math.hypot(event.clientX - gesture.event.clientX, event.clientY - gesture.event.clientY) > 5) return
    const id = interaction.hitTest(event.clientX, event.clientY)
    if (id !== gesture.id) return
    event.preventDefault()
    event.stopPropagation()
    interaction.onSelect(id, { x: event.clientX, y: event.clientY })
  }
  viewport.addEventListener("pointerdown", onDown)
  viewport.addEventListener("pointermove", trackMovement)
  viewport.addEventListener("pointerup", onUp)
  viewport.addEventListener("pointercancel", cancel)
  viewport.addEventListener("pointerleave", cancel)
  viewport.addEventListener("click", onClick)
  window.addEventListener("blur", cancel)
  return () => {
    cancel()
    viewport.removeEventListener("pointerdown", onDown)
    viewport.removeEventListener("pointermove", trackMovement)
    viewport.removeEventListener("pointerup", onUp)
    viewport.removeEventListener("pointercancel", cancel)
    viewport.removeEventListener("pointerleave", cancel)
    viewport.removeEventListener("click", onClick)
    window.removeEventListener("blur", cancel)
  }
}