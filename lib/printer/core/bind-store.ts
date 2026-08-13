const STORAGE_KEY = "makinari-printer-binds"

import type { WorkstationBind } from "./types"

function readAll(): Record<string, WorkstationBind> {
  if (typeof localStorage === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export const PRINTER_BIND_CHANGED_EVENT = "printers:bind-changed"

function notifyBindChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PRINTER_BIND_CHANGED_EVENT))
}

function writeAll(map: Record<string, WorkstationBind>) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  notifyBindChanged()
}

export function getPrinterBind(printerId: string): WorkstationBind | null {
  return readAll()[printerId] || null
}

export function setPrinterBind(bind: WorkstationBind): void {
  const map = readAll()
  map[bind.printerId] = bind
  writeAll(map)
}

export function clearPrinterBind(printerId: string): void {
  const map = readAll()
  delete map[printerId]
  writeAll(map)
}

export function listPrinterBinds(): WorkstationBind[] {
  return Object.values(readAll())
}
