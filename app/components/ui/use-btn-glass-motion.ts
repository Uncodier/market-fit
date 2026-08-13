"use client"

import * as React from "react"

type Blob = { x: number; y: number; tx: number; ty: number; pause: number }

type Entry = {
  el: HTMLElement
  well: HTMLElement | null
  a: Blob
  b: Blob
  mx: number
  my: number
  cx: number
  cy: number
  w: number
  h: number
  hovering: boolean
  visible: boolean
  io: IntersectionObserver
  ro: ResizeObserver
  prev: Record<string, string>
}

const entries = new Set<Entry>()
let raf = 0
let last = 0
let lastWrite = 0
let safari = false

function detectSafari() {
  if (typeof navigator === "undefined") return false
  if (typeof document !== "undefined" && document.documentElement.classList.contains("safari")) {
    return true
  }
  const ua = navigator.userAgent
  return Boolean(
    ua.match(/AppleWebKit\/[\d.]+/g) &&
      ua.match(/Version\/[\d.]+.*Safari/) &&
      !ua.match(/Chrome\/[\d.]+/g) &&
      !ua.match(/Chromium\/[\d.]+/g) &&
      !ua.match(/Edg\/[\d.]+/g) &&
      !ua.match(/Firefox\/[\d.]+/g)
  )
}

function createBlob(): Blob {
  const x = Math.random()
  const y = Math.random()
  return { x, y, tx: x, ty: y, pause: 0.2 + Math.random() * 0.8 }
}

function stepBlob(blob: Blob, dt: number, wander: number) {
  blob.pause -= dt
  if (blob.pause <= 0) {
    blob.tx = Math.min(1, Math.max(0, blob.x + (Math.random() - 0.5) * wander))
    blob.ty = Math.min(1, Math.max(0, blob.y + (Math.random() - 0.5) * wander))
    blob.pause = 0.9 + Math.random() * 2.2
  }
  const ease = 1 - Math.exp(-dt * 0.85)
  blob.x += (blob.tx - blob.x) * ease
  blob.y += (blob.ty - blob.y) * ease
}

function setVar(entry: Entry, name: string, value: string) {
  if (entry.prev[name] === value) return
  entry.prev[name] = value
  entry.el.style.setProperty(name, value)
  entry.well?.style.setProperty(name, value)
}

function writeEntry(entry: Entry) {
  const { w, h } = entry
  setVar(entry, "--gx", `${(entry.a.x * w).toFixed(1)}px`)
  setVar(entry, "--gy", `${(entry.a.y * h).toFixed(1)}px`)
  if (!safari) {
    setVar(entry, "--gx2", `${(entry.b.x * w).toFixed(1)}px`)
    setVar(entry, "--gy2", `${(entry.b.y * h).toFixed(1)}px`)
  }
  if (entry.hovering) {
    setVar(entry, "--mx", `${(entry.cx * w).toFixed(1)}px`)
    setVar(entry, "--my", `${(entry.cy * h).toFixed(1)}px`)
  }
  if (safari) return
  const lx = entry.hovering
    ? entry.cx * 0.72 + entry.a.x * 0.16 + entry.b.x * 0.12
    : entry.a.x * 0.58 + entry.b.x * 0.42
  const ly = entry.hovering
    ? entry.cy * 0.72 + entry.a.y * 0.16 + entry.b.y * 0.12
    : entry.a.y * 0.58 + entry.b.y * 0.42
  setVar(entry, "--shx", `${((lx - 0.5) * 2.6).toFixed(2)}px`)
  setVar(entry, "--shy", `${((ly - 0.5) * 2.2).toFixed(2)}px`)
}

function loop(now: number) {
  if (entries.size === 0) {
    raf = 0
    return
  }
  raf = requestAnimationFrame(loop)
  if (document.hidden) {
    last = now
    return
  }
  const dt = Math.min(0.048, (now - last) / 1000)
  last = now
  for (const entry of entries) {
    if (!entry.visible) continue
    stepBlob(entry.a, dt, 0.95)
    if (!safari) stepBlob(entry.b, dt, 1.1)
    if (entry.hovering) {
      const follow = 1 - Math.exp(-dt * 10)
      entry.cx += (entry.mx - entry.cx) * follow
      entry.cy += (entry.my - entry.cy) * follow
    }
  }
  if (safari && now - lastWrite < 33) return
  lastWrite = now
  for (const entry of entries) {
    if (!entry.visible) continue
    writeEntry(entry)
  }
}

function startLoop() {
  if (raf || entries.size === 0) return
  last = performance.now()
  lastWrite = 0
  raf = requestAnimationFrame(loop)
}

function measure(entry: Entry) {
  entry.w = entry.el.offsetWidth || entry.w
  entry.h = entry.el.offsetHeight || entry.h
}

export function useBtnGlassMotion(enabled: boolean) {
  const [node, setNode] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    if (!enabled || !node) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    safari = detectSafari()

    const well =
      node.parentElement?.classList.contains("btn-primary-well") ? node.parentElement : null
    const host = well ?? node

    const entry: Entry = {
      el: node,
      well,
      a: createBlob(),
      b: createBlob(),
      mx: 0.5,
      my: 0.5,
      cx: 0.5,
      cy: 0.5,
      w: node.offsetWidth || 162,
      h: node.offsetHeight || 36,
      hovering: false,
      visible: true,
      prev: {},
      io: new IntersectionObserver(([item]) => {
        entry.visible = item.isIntersecting
      }),
      ro: new ResizeObserver(() => measure(entry)),
    }

    const readPointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      entry.w = rect.width
      entry.h = rect.height
      entry.mx = (event.clientX - rect.left) / rect.width
      entry.my = (event.clientY - rect.top) / rect.height
    }

    const onEnter = (event: PointerEvent) => {
      readPointer(event)
      entry.cx = entry.mx
      entry.cy = entry.my
      entry.hovering = true
    }

    const onMove = (event: PointerEvent) => {
      readPointer(event)
      entry.hovering = true
    }

    const onLeave = () => {
      entry.hovering = false
    }

    host.addEventListener("pointerenter", onEnter)
    host.addEventListener("pointermove", onMove, { passive: true })
    host.addEventListener("pointerleave", onLeave)
    entry.io.observe(node)
    entry.ro.observe(node)
    entries.add(entry)
    writeEntry(entry)
    startLoop()

    return () => {
      host.removeEventListener("pointerenter", onEnter)
      host.removeEventListener("pointermove", onMove)
      host.removeEventListener("pointerleave", onLeave)
      entry.io.disconnect()
      entry.ro.disconnect()
      entries.delete(entry)
    }
  }, [enabled, node])

  return setNode
}
