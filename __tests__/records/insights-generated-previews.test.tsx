import { fireEvent, render, screen } from "@testing-library/react"
import { InsightGeneratedPreviews } from "@/app/records/[id]/components/InsightGeneratedPreviews"
import { publicPromptImageUrl } from "@/app/lib/image-utils"
import { insightRecord, previewField, relationField } from "./insights-test-fixtures"

jest.mock("@/app/lib/image-utils", () => ({ publicPromptImageUrl: jest.fn() }))

const imageUrl = jest.mocked(publicPromptImageUrl)
const placeholder = "/images/image-placeholder.svg"

function renderPreview(withRelation = false) {
  return render(
    <InsightGeneratedPreviews
      fields={[previewField]}
      formData={{ Concept: "draft" }}
      record={insightRecord()}
      activeRelations={withRelation ? [relationField] : []}
      relationsData={{ Customer: "customer-1" }}
      allRelationLabels={{ "customer-1": "Example Customer" }}
      categoryHistory={[]}
    />,
  )
}

describe("generated record previews", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    imageUrl.mockImplementation((prompt, size, siteId) =>
      `/api/images/prompt?prompt=${encodeURIComponent(prompt)}&size=${size}${siteId ? `&site_id=${siteId}` : ""}`,
    )
  })

  afterEach(() => jest.restoreAllMocks())

  it("uses the shared helper and record site for standalone images and full-size links", () => {
    renderPreview()

    const url = imageUrl.mock.results[0].value
    expect(imageUrl).toHaveBeenCalledWith("Illustrate draft beside draft", 512, "site-1")
    expect(screen.getByRole("img", { name: "Concept" })).toHaveAttribute("src", url)
    expect(screen.getByRole("img")).toHaveClass("w-full", "h-auto", "object-cover", "min-h-[120px]")
    expect(screen.getByRole("link", { name: /Full Size/ })).toHaveAttribute("href", url)
    expect(screen.getByRole("link")).toHaveAttribute("target", "_blank")
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noreferrer")
    expect(screen.getByText("Current")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("leaves site resolution to the helper when a record site is unavailable", () => {
    render(
      <InsightGeneratedPreviews
        fields={[{ ...previewField, aiPreview: { enabled: true } }]}
        formData={{ Concept: "trees & rivers" }}
        activeRelations={[]}
        allRelationLabels={{}}
        categoryHistory={[]}
      />,
    )

    expect(imageUrl).toHaveBeenCalledWith("Generate an image about: trees & rivers", 512, undefined)
    expect(screen.getByRole("img")).toHaveAttribute("src", imageUrl.mock.results[0].value)
  })

  it.each(["site-1", undefined])("integrates with the real same-origin helper (site: %s)", (siteId) => {
    const actual = jest.requireActual<typeof import("@/app/lib/image-utils")>("@/app/lib/image-utils")
    imageUrl.mockImplementation(actual.publicPromptImageUrl)
    render(
      <InsightGeneratedPreviews
        fields={[previewField]}
        formData={{ Concept: "trees & rivers / café?" }}
        record={{ site_id: siteId }}
        activeRelations={[]}
        allRelationLabels={{}}
        categoryHistory={[]}
      />,
    )

    const src = screen.getByRole("img").getAttribute("src")!
    expect(src).toMatch(/^\/api\/images\/prompt\?/)
    const query = new URLSearchParams(src.split("?")[1])
    expect(query.get("prompt")).toBe("Illustrate trees & rivers / café? beside trees & rivers / café?")
    expect(query.get("width")).toBe("512")
    expect(query.get("height")).toBe("512")
    expect(query.get("site_id")).toBe(siteId ?? null)
    expect(screen.getByRole("link")).toHaveAttribute("href", src)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps related history oldest-first and the unsaved current preview last", () => {
    const historical = (id: string, value: string, day: string, customer = "customer-1") => insightRecord({
      id,
      created_at: `2026-01-${day}T12:00:00Z`,
      data: { Concept: value },
      relations: { Customer: customer },
    })
    render(
      <InsightGeneratedPreviews
        fields={[previewField]}
        formData={{ Concept: "draft" }}
        record={insightRecord()}
        activeRelations={[relationField]}
        relationsData={{ Customer: "customer-1" }}
        allRelationLabels={{ "customer-1": "Example Customer" }}
        categoryHistory={[
          historical("newer", "second", "02"),
          historical("current-record", "saved draft", "03"),
          historical("older", "first", "01"),
          historical("unrelated", "different customer", "01", "customer-2"),
          historical("empty", "", "01"),
        ]}
      />,
    )

    expect(screen.getByText("Concept - Example Customer")).toBeInTheDocument()
    expect(screen.getAllByRole("img").map(image => image.getAttribute("alt"))).toEqual(["first", "second", "draft"])
    expect(imageUrl.mock.calls).toEqual([
      ["Illustrate first beside first", 512, "site-1"],
      ["Illustrate second beside second", 512, "site-1"],
      ["Illustrate draft beside draft", 512, "site-1"],
    ])
    screen.getAllByRole("img").forEach((image, index) => {
      const url = imageUrl.mock.results[index].value
      expect(image).toHaveAttribute("src", url)
      expect(image).toHaveClass("h-24", "object-cover")
      expect(screen.getAllByRole("link")[index]).toHaveAttribute("href", url)
    })
    expect(screen.getByRole("img", { name: "draft" }).parentElement).toHaveClass("border-primary", "snap-start")
    expect(screen.getByRole("img", { name: "first" }).parentElement).toHaveClass("border-border/40")
    expect(screen.getByText(new Date("2026-01-01T12:00:00Z").toLocaleDateString())).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([false, true])("uses a safe non-looping fallback without logging (related: %s)", (withRelation) => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined)
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
    renderPreview(withRelation)
    const image = screen.getByRole("img") as HTMLImageElement
    const setSrc = jest.spyOn(image, "src", "set")

    fireEvent.error(image)
    expect(image).toHaveAttribute("src", placeholder)
    fireEvent.error(image)
    fireEvent.error(image)
    expect(setSrc).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it("retries a changed prompt after a previous image fell back", () => {
    const props = {
      fields: [previewField],
      formData: { Concept: "first" },
      record: insightRecord(),
      activeRelations: [],
      allRelationLabels: {},
      categoryHistory: [],
    }
    const { rerender } = render(<InsightGeneratedPreviews {...props} />)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.getByRole("img")).toHaveAttribute("src", placeholder)

    rerender(<InsightGeneratedPreviews {...props} formData={{ Concept: "second" }} />)
    expect(screen.getByRole("img")).toHaveAttribute("src", imageUrl.mock.results[1].value)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.getByRole("img")).toHaveAttribute("src", placeholder)
  })

  it.each([false, true])("does not generate an image for empty values (related: %s)", (withRelation) => {
    render(
      <InsightGeneratedPreviews
        fields={[previewField, { ...previewField, id: "disabled", name: "Disabled", aiPreview: { enabled: false } }]}
        formData={{ Concept: "", Disabled: "ignored" }}
        activeRelations={withRelation ? [relationField] : []}
        relationsData={{ Customer: "customer-1" }}
        allRelationLabels={{}}
        categoryHistory={[]}
      />,
    )
    expect(imageUrl).not.toHaveBeenCalled()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })
})