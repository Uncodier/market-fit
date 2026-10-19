"use client"

import { useEffect, useRef, useState } from "react"
import { importCatalogBatch, previewCatalogImportBatch } from "../import-actions"
import { inferCatalogImportMapping, normalizeCatalogImportRows, type CatalogImportMapping, type CatalogImportRow } from "../import-schema"
import { parseCatalogImportFile, type ParsedCatalogFile } from "../import-file"
import { createImportCatalogBatches, runImportCatalogSession, type ImportCatalogError, type ImportCatalogMode, type ImportCatalogSession } from "./ImportCatalogRunner"

export type ImportCatalogStep = "upload" | "mapping" | "review" | "import"
export interface ImportCatalogReview {
  rows: CatalogImportRow[]
  errors: ImportCatalogError[]
  existingSkus: string[]
  missingCategories: string[]
}

export function useImportCatalogState(siteId: string, onSuccess: () => void) {
  const [step, setStep] = useState<ImportCatalogStep>("upload")
  const [parsed, setParsed] = useState<ParsedCatalogFile | null>(null)
  const [fileName, setFileName] = useState("")
  const [mapping, setMapping] = useState<CatalogImportMapping>({})
  const [defaultCurrency, setDefaultCurrency] = useState("USD")
  const [mode, setMode] = useState<ImportCatalogMode>("skip")
  const [review, setReview] = useState<ImportCatalogReview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [scanRows, setScanRows] = useState(0)
  const [sessionView, setSessionView] = useState<ImportCatalogSession | null>(null)
  const [status, setStatus] = useState<"running" | "paused" | "done">("paused")
  const [stopRequested, setStopRequested] = useState(false)
  const session = useRef<ImportCatalogSession | null>(null)
  const mounted = useRef(false)
  const generation = useRef(0)
  const stop = useRef(false)
  const running = useRef(false)
  const notifiedChanges = useRef(0)
  const success = useRef(onSuccess)
  success.current = onSuccess

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; generation.current += 1; stop.current = true }
  }, [])

  const currentOperation = () => {
    const token = ++generation.current
    return () => mounted.current && generation.current === token
  }

  const selectFile = async (file: File) => {
    if (running.current) return
    const isCurrent = currentOperation()
    setBusy(true)
    setError("")
    try {
      const result = await parseCatalogImportFile(file)
      if (!isCurrent()) return
      setParsed(result)
      setFileName(file.name)
      setMapping(inferCatalogImportMapping(result.headers))
      setReview(null)
      setStep("mapping")
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : "The file could not be read.")
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  const prepareReview = async () => {
    if (!parsed || !mapping.sku || !mapping.name || busy) return
    const isCurrent = currentOperation()
    setBusy(true)
    setError("")
    setScanRows(0)
    try {
      const normalized = normalizeCatalogImportRows(parsed.rows, mapping, defaultCurrency)
      const physical = (number: number) => parsed.rowNumbers[number - 2] ?? number
      const rows = normalized.rows.map(row => ({ ...row, rowNumber: physical(row.rowNumber) }))
      const errors = normalized.errors.map(row => ({ ...row, rowNumber: physical(row.rowNumber) }))
      const batches = createImportCatalogBatches(rows, siteId)
      const existingSkus = new Set<string>()
      const missingCategories = new Set<string>()
      let scanned = 0
      for (const batch of batches) {
        if (!isCurrent()) return
        const result = await previewCatalogImportBatch(siteId, batch.rows)
        if (!isCurrent()) return
        if (result.error || !result.data) throw new Error(result.error || "The catalog preview could not be loaded.")
        result.data.existingSkus.forEach((sku: string) => existingSkus.add(sku))
        result.data.missingCategories.forEach((category: string) => missingCategories.add(category))
        scanned += batch.rows.length
        setScanRows(scanned)
      }
      if (!isCurrent()) return
      rows.forEach(row => {
        if (row.category && missingCategories.has(row.category)) {
          errors.push({ rowNumber: row.rowNumber, message: `Category "${row.category}" must match exactly one active category. This row will be rejected.` })
        }
      })
      setReview({ rows, errors, existingSkus: [...existingSkus], missingCategories: [...missingCategories] })
      setStep("review")
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : "The catalog preview could not be loaded.")
    } finally {
      if (isCurrent()) setBusy(false)
    }
  }

  const execute = async (activeSession: ImportCatalogSession) => {
    if (running.current) return
    const isCurrent = currentOperation()
    running.current = true
    stop.current = false
    setStopRequested(false)
    setBusy(true)
    setError("")
    setStatus("running")
    setStep("import")
    const publish = () => setSessionView({ ...activeSession, totals: { ...activeSession.totals, errors: [...activeSession.totals.errors] } })
    publish()
    try {
      const result = await runImportCatalogSession(activeSession, siteId, importCatalogBatch,
        isCurrent, () => stop.current, publish)
      if (!isCurrent()) return
      setStatus(result.status === "done" ? "done" : "paused")
      setError(result.error || "")
      const changes = activeSession.totals.created + activeSession.totals.updated
      if (changes > notifiedChanges.current) {
        notifiedChanges.current = changes
        try { success.current() } catch { /* Refresh failures do not invalidate committed receipts. */ }
      }
    } finally {
      running.current = false
      if (isCurrent()) setBusy(false)
    }
  }

  const confirm = () => {
    if (!review?.rows.length || session.current || running.current) return
    try {
      const validRows = review.rows.filter(row => !row.category || !review.missingCategories.includes(row.category))
      if (!validRows.length) return
      session.current = {
        batches: createImportCatalogBatches(validRows, siteId), mode, nextBatch: 0, completedRows: 0,
        totals: { created: 0, updated: 0, skipped: 0, errors: [] },
      }
      void execute(session.current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The import could not be prepared.")
    }
  }

  const requestStop = () => { stop.current = true; setStopRequested(true) }
  const resume = () => { if (session.current) void execute(session.current) }
  const reset = () => {
    if (running.current) return
    generation.current += 1
    session.current = null
    notifiedChanges.current = 0
    setSessionView(null)
    setParsed(null)
    setReview(null)
    setMapping({})
    setFileName("")
    setError("")
    setDefaultCurrency("USD")
    setMode("skip")
    setStep("upload")
  }

  return { step, setStep, parsed, fileName, mapping, setMapping, defaultCurrency, setDefaultCurrency,
    mode, setMode, review, busy, error, scanRows, session: sessionView, status, stopRequested,
    selectFile, prepareReview, confirm, requestStop, resume, reset }
}