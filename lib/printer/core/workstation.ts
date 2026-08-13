const STORAGE_KEY = "makinari-printer-station"

export const PRINTER_STATION_CHANGED_EVENT = "printers:station-changed"

export type PrinterWorkstation = {
  id: string
  name: string
}

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `station_${Date.now()}`
}

function notifyChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PRINTER_STATION_CHANGED_EVENT))
}

function readRaw(): Partial<PrinterWorkstation> | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function write(station: PrinterWorkstation) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(station))
  notifyChanged()
}

export function getPrinterWorkstation(): PrinterWorkstation {
  const raw = readRaw()
  const id = typeof raw?.id === "string" && raw.id ? raw.id : newId()
  const name = typeof raw?.name === "string" && raw.name.trim() ? raw.name.trim() : "This computer"
  const station = { id, name }
  if (!raw?.id || raw.name !== station.name) write(station)
  return station
}

export function setPrinterWorkstationName(name: string): PrinterWorkstation {
  const current = getPrinterWorkstation()
  const next = { ...current, name: name.trim() || "This computer" }
  write(next)
  return next
}
