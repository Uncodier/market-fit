"use client"

import { useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Download, UploadCloud } from "@/app/components/ui/icons"
import { createCatalogImportSample, type CatalogImportSampleFormat } from "../import-samples"

interface Props {
  busy: boolean
  onSelectFile: (file: File) => Promise<void>
}

export function ImportCatalogUpload({ busy, onSelectFile }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  const download = async (format: CatalogImportSampleFormat) => {
    setDownloading(true)
    setDownloadError("")
    try {
      const { blob, fileName } = await createCatalogImportSample(format)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = fileName
      document.body.appendChild(anchor)
      try { anchor.click() } finally {
        anchor.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch {
      setDownloadError("The sample file could not be downloaded. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy || downloading} onClick={() => void download("csv")}>
          <Download className="mr-2 h-4 w-4" aria-hidden={true} />CSV Sample
        </Button>
        <Button variant="outline" size="sm" disabled={busy || downloading} onClick={() => void download("xlsx")}>
          <Download className="mr-2 h-4 w-4" aria-hidden={true} />Excel Sample
        </Button>
      </div>
      {downloadError && <p role="alert" className="text-sm text-destructive">{downloadError}</p>}
      <button type="button" disabled={busy} aria-describedby="catalog-import-limits"
        className={`w-full rounded-lg border-2 border-dashed p-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-50 ${
          dragging ? "border-blue-500 bg-blue-500/5" : "border-gray-300 hover:border-gray-400"
        }`}
        onClick={() => input.current?.click()}
        onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => {
          event.preventDefault()
          setDragging(false)
          const file = event.dataTransfer.files[0]
          if (file && !busy) void onSelectFile(file)
        }}>
        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden={true} />
        <span className="mt-2 block text-sm text-muted-foreground"><span className="font-medium">Click to upload</span> or drag and drop</span>
        <span className="block text-xs text-muted-foreground">CSV or Excel (.xlsx) files up to 10 MB</span>
      </button>
      <input ref={input} id="catalog-import-file" type="file" accept=".csv,.xlsx" disabled={busy}
        aria-label="Choose a file or drag it here" className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file && !busy) void onSelectFile(file)
          event.target.value = ""
        }} />
      <details id="catalog-import-limits" className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">File requirements and limits</summary>
        <div className="mt-2 space-y-2">
          <p>Maximum 20,000 nonempty data rows and 50 columns. For Excel files, only the first worksheet is read. Legacy .xls is not supported.</p>
          <p>The first row must contain unique, nonempty headers. SKU and Name are required. Empty data rows are skipped; errors retain source row numbers.</p>
          <p>Maximum 100,001 source rows including empty rows; XLSX expanded size is limited to 50 MB.</p>
          <p>Replace the sample products with your own data. Category names must match existing active categories; leave Category and Image URL blank when not needed.</p>
        </div>
      </details>
      {busy && <p role="status" className="text-sm text-muted-foreground">Reading file…</p>}
    </div>
  )
}