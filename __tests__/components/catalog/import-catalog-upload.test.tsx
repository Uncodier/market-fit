import { act, fireEvent, render, screen } from "@testing-library/react"
import { ImportCatalogUpload } from "@/app/catalog/components/ImportCatalogUpload"
import { createCatalogImportSample } from "@/app/catalog/import-samples"

jest.mock("@/app/catalog/import-samples", () => ({ createCatalogImportSample: jest.fn() }))
const create = jest.mocked(createCatalogImportSample)
const select = jest.fn<Promise<void>, [File]>().mockResolvedValue(undefined)
const createUrl = jest.fn(() => "blob:catalog-sample")
const revokeUrl = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl })
})

afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it.each([["CSV Sample", "csv"], ["Excel Sample", "xlsx"]] as const)("downloads %s with the supported extension and cleans up its object URL", async (name, format) => {
  jest.useFakeTimers()
  const blob = new Blob(["example"])
  create.mockResolvedValue({ blob, fileName: `catalog-sample.${format}` })
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    expect(this).toHaveAttribute("download", `catalog-sample.${format}`)
    expect(this).toHaveAttribute("href", "blob:catalog-sample")
    expect(document.body.contains(this)).toBe(true)
  })
  render(<ImportCatalogUpload busy={false} onSelectFile={select} />)
  await act(async () => { fireEvent.click(screen.getByRole("button", { name })) })
  expect(create).toHaveBeenCalledWith(format)
  expect(createUrl).toHaveBeenCalledWith(blob)
  expect(anchorClick).toHaveBeenCalledTimes(1)
  expect(document.querySelector("a[download]")).toBeNull()
  act(() => jest.runOnlyPendingTimers())
  expect(revokeUrl).toHaveBeenCalledWith("blob:catalog-sample")
  expect(select).not.toHaveBeenCalled()
})

it("shows a recoverable download error without selecting or importing a file", async () => {
  create.mockRejectedValue(new Error("Download unavailable"))
  render(<ImportCatalogUpload busy={false} onSelectFile={select} />)
  fireEvent.click(screen.getByRole("button", { name: "Excel Sample" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("The sample file could not be downloaded")
  expect(screen.getByRole("button", { name: "Excel Sample" })).toBeEnabled()
  expect(select).not.toHaveBeenCalled()
})

it("opens a hidden picker, accepts click and drop selection, and allows the same file to be selected again", async () => {
  render(<ImportCatalogUpload busy={false} onSelectFile={select} />)
  const picker = screen.getByLabelText("Choose a file or drag it here")
  expect(picker).toHaveAttribute("accept", ".csv,.xlsx")
  expect(picker).toHaveClass("hidden")
  const click = jest.spyOn(picker, "click")
  const dropzone = screen.getByRole("button", { name: /Click to upload/ })
  fireEvent.click(dropzone)
  expect(click).toHaveBeenCalledTimes(1)
  const file = new File(["example"], "catalog.csv")
  await act(async () => { fireEvent.change(picker, { target: { files: [file] } }) })
  expect(picker).toHaveValue("")
  await act(async () => { fireEvent.change(picker, { target: { files: [file] } }) })
  await act(async () => { fireEvent.drop(dropzone, { dataTransfer: { files: [file] } }) })
  expect(select).toHaveBeenCalledTimes(3)
  expect(select).toHaveBeenLastCalledWith(file)
})

it("disables file selection and downloads while the parser is busy", async () => {
  render(<ImportCatalogUpload busy onSelectFile={select} />)
  const dropzone = screen.getByRole("button", { name: /Click to upload/ })
  expect(dropzone).toBeDisabled()
  expect(screen.getByRole("button", { name: "CSV Sample" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Excel Sample" })).toBeDisabled()
  expect(screen.getByRole("status")).toHaveTextContent("Reading file")
  const file = new File(["example"], "catalog.csv")
  await act(async () => { fireEvent.drop(dropzone, { dataTransfer: { files: [file] } }) })
  expect(select).not.toHaveBeenCalled()
})