"use client"

export type ReportExportSnapshot = {
  scopeKey: string
  report: string
  section: string
  siteId: string
  userId: string
  ready: boolean
  download: () => void
}

let snapshot: ReportExportSnapshot | null = null
let owner: symbol | null = null
const listeners = new Set<() => void>()

export const getReportExportSnapshot = () => snapshot
export const getServerReportExportSnapshot = () => null

export function subscribeReportExport(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function publishReportExport(token: symbol, value: ReportExportSnapshot) {
  owner = token
  snapshot = value
  listeners.forEach(listener => listener())
}

export function clearReportExport(token: symbol) {
  if (owner !== token) return
  owner = null
  snapshot = null
  listeners.forEach(listener => listener())
}

export function ownsReportExport(token: symbol) {
  return owner === token
}