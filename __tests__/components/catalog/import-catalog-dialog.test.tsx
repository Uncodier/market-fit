import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ImportCatalogDialog } from "@/app/catalog/components/ImportCatalogDialog"
import { importCatalogBatch, previewCatalogImportBatch } from "@/app/catalog/import-actions"
import { parseCatalogImportFile } from "@/app/catalog/import-file"
import { randomUUID } from "node:crypto"
import type { CatalogImportRow } from "@/app/catalog/import-schema"

jest.mock("@/app/catalog/import-actions", () => ({ importCatalogBatch: jest.fn(), previewCatalogImportBatch: jest.fn() }))
jest.mock("@/app/catalog/import-file", () => ({ ...jest.requireActual("@/app/catalog/import-file"), parseCatalogImportFile: jest.fn() }))

const parse = jest.mocked(parseCatalogImportFile)
const preview = jest.mocked(previewCatalogImportBatch)
const write = jest.mocked(importCatalogBatch)
const siteId = "00000000-0000-4000-8000-000000000001"
const secondSiteId = "00000000-0000-4000-8000-000000000002"
const success = jest.fn()

function data(count = 1) {
  return { headers: ["sku", "name"], rows: Array.from({ length: count }, (_, index) => ({ sku: `SKU-${index}`, name: `Product ${index}` })), rowNumbers: Array.from({ length: count }, (_, index) => index + 2) }
}
const receipt = (created: number) => ({ data: { created, updated: 0, skipped: 0, errors: [] } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(crypto, "randomUUID", { value: randomUUID, configurable: true })
  parse.mockResolvedValue(data())
  preview.mockResolvedValue({ data: { existingSkus: [], missingCategories: [] } })
  write.mockImplementation(async (_site: string, rows: CatalogImportRow[]) => receipt(rows.length))
})

function mount() {
  const onOpenChange = jest.fn()
  const view = render(<ImportCatalogDialog open siteId={siteId} onOpenChange={onOpenChange} onSuccess={success} />)
  return { ...view, onOpenChange }
}
async function reviewFile() {
  fireEvent.change(screen.getByLabelText("Choose a file or drag it here"), { target: { files: [new File(["synthetic"], "catalog.csv")] } })
  await screen.findByText("Match your columns")
  fireEvent.click(screen.getByRole("button", { name: "Review import" }))
  await screen.findByText("No changes have been made.", { exact: false })
}
function confirm() {
  fireEvent.click(screen.getByLabelText("I have reviewed the preview, import mode, and any errors.", { exact: false }))
  fireEvent.click(screen.getByRole("button", { name: /Confirm import/ }))
}

it("requires explicit reviewed confirmation and defaults to USD and skip", async () => {
  mount()
  fireEvent.change(screen.getByLabelText("Choose a file or drag it here"), { target: { files: [new File(["x"], "catalog.csv")] } })
  await screen.findByText("Match your columns")
  expect(screen.getByLabelText("Default currency for new products")).toHaveValue("USD")
  expect(write).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Review import" }))
  await screen.findByText("No changes have been made.", { exact: false })
  expect(screen.getByRole("button", { name: /Confirm import/ })).toBeDisabled()
  expect(write).not.toHaveBeenCalled()
  confirm()
  await screen.findByText("Import complete")
  expect(write).toHaveBeenCalledWith(siteId, expect.any(Array), "skip", expect.any(String))
  expect(write.mock.calls[0][1][0].defaultCurrency).toBe("USD")
  expect(success).toHaveBeenCalledTimes(1)
})

it("requires SKU/name mapping and a three-letter explicitly selected default currency", async () => {
  mount()
  fireEvent.change(screen.getByLabelText("Choose a file or drag it here"), { target: { files: [new File(["x"], "catalog.csv")] } })
  await screen.findByText("Match your columns")
  fireEvent.change(screen.getByLabelText("Default currency for new products"), { target: { value: "US" } })
  expect(screen.getByRole("button", { name: "Review import" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Default currency for new products"), { target: { value: "eur" } })
  expect(screen.getByLabelText("Default currency for new products")).toHaveValue("EUR")
  expect(screen.getByRole("button", { name: "Review import" })).toBeEnabled()
})

it("update mode is opt-in and changing it requires renewed review acknowledgement", async () => {
  Element.prototype.scrollIntoView = jest.fn()
  mount()
  await reviewFile()
  fireEvent.click(screen.getByLabelText("I have reviewed the preview, import mode, and any errors.", { exact: false }))
  fireEvent.keyDown(screen.getByLabelText("When an SKU already exists"), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: "Update existing products" }))
  expect(screen.getByText("Update is enabled.", { exact: false })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Confirm import/ })).toBeDisabled()
  confirm()
  await screen.findByText("Import complete")
  expect(write.mock.calls[0][2]).toBe("update")
})

it("preflight failures do not reach review or write any rows", async () => {
  preview.mockResolvedValue({ error: "Catalog preview unavailable" })
  mount()
  fireEvent.change(screen.getByLabelText("Choose a file or drag it here"), { target: { files: [new File(["x"], "catalog.csv")] } })
  await screen.findByText("Match your columns")
  fireEvent.click(screen.getByRole("button", { name: "Review import" }))
  await screen.findByRole("alert")
  expect(screen.getByRole("alert")).toHaveTextContent("Catalog preview unavailable")
  expect(screen.queryByRole("button", { name: /Confirm import/ })).not.toBeInTheDocument()
  expect(write).not.toHaveBeenCalled()
})

it("preflights every batch and keeps progress at acknowledged rows; stop is between batches and resumable", async () => {
  parse.mockResolvedValue(data(205))
  const pending = deferred<ReturnType<typeof receipt>>()
  write.mockImplementationOnce(() => pending.promise)
  const { onOpenChange } = mount()
  await reviewFile()
  expect(preview.mock.calls.map(call => call[1].length)).toEqual([100, 100, 5])
  expect(write).not.toHaveBeenCalled()
  confirm()
  await screen.findByText("0 of 205 rows completed")
  expect(screen.getByRole("progressbar", { name: "Catalog import progress" })).toHaveAttribute("aria-valuenow", "0")
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(onOpenChange).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Stop after this batch" }))
  expect(write).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve(receipt(100)))
  await screen.findByText("Import paused")
  expect(screen.getByText("100 of 205 rows completed")).toBeInTheDocument()
  expect(success).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Resume import" }))
  await screen.findByText("Import complete")
  expect(write).toHaveBeenCalledTimes(3)
  expect(screen.getByText("205 created")).toBeInTheDocument()
  expect(success).toHaveBeenCalledTimes(2)
})

it("pauses on a server error, retains committed totals and reuses the pending batch requestId on Resume", async () => {
  parse.mockResolvedValue(data(205))
  write.mockResolvedValueOnce(receipt(100)).mockResolvedValueOnce({ error: "Retry this batch" })
  mount()
  await reviewFile()
  confirm()
  await screen.findByText("Import paused")
  expect(screen.getByRole("alert")).toHaveTextContent("Retry this batch")
  expect(screen.getByText("100 created")).toBeInTheDocument()
  expect(success).toHaveBeenCalledTimes(1)
  const failedRequest = write.mock.calls[1][3]
  fireEvent.click(screen.getByRole("button", { name: "Resume import" }))
  await screen.findByText("Import complete")
  expect(write.mock.calls[2][3]).toBe(failedRequest)
  expect(screen.getByText("205 created")).toBeInTheDocument()
  expect(success).toHaveBeenCalledTimes(2)
})

it.each(["site change", "unmount", "parent close"])("ignores stale results and stops future batches on %s", async kind => {
  parse.mockResolvedValue(data(205))
  const pending = deferred<ReturnType<typeof receipt>>()
  write.mockImplementationOnce(() => pending.promise)
  const view = mount()
  await reviewFile()
  confirm()
  await waitFor(() => expect(write).toHaveBeenCalledTimes(1))
  if (kind === "unmount") view.unmount()
  else view.rerender(<ImportCatalogDialog open={kind !== "parent close"} siteId={secondSiteId} onOpenChange={view.onOpenChange} onSuccess={success} />)
  await act(async () => pending.resolve(receipt(100)))
  expect(write).toHaveBeenCalledTimes(1)
  expect(success).not.toHaveBeenCalled()
  if (kind === "site change") expect(screen.getByLabelText("Choose a file or drag it here")).toBeInTheDocument()
})

it("shows source validation errors before confirmation and keeps missing-category errors in final results", async () => {
  parse.mockResolvedValue({ headers: ["sku", "name", "category"], rows: [{ sku: "A", name: "Valid", category: "" }, { sku: "B", name: "Missing category", category: "Absent" }, { sku: "C", name: "", category: "" }], rowNumbers: [2, 4, 7] })
  preview.mockResolvedValue({ data: { existingSkus: ["A"], missingCategories: ["Absent"] } })
  mount()
  await reviewFile()
  expect(screen.getByRole("button", { name: "Confirm import (1 valid rows)" })).toBeDisabled()
  expect(screen.getByText(/Row 7:/)).toBeInTheDocument()
  expect(screen.getByText(/Row 4:/)).toHaveTextContent("Absent")
  confirm()
  await screen.findByText("Import complete")
  expect(write.mock.calls[0][1]).toHaveLength(1)
  expect(screen.getByText(/Row 4:/)).toHaveTextContent("Absent")
  expect(screen.getByRole("button", { name: "Download error CSV" })).toBeInTheDocument()
})