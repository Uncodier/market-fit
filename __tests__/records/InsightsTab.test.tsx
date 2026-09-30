import { render, screen, waitFor } from "@testing-library/react"
import { InsightsTab } from "@/app/records/[id]/components/InsightsTab"
import { publicPromptImageUrl } from "@/app/lib/image-utils"
import { getRecords, getHistoricalRelatedRecords, resolveRelationsForSidebar } from "@/app/records/actions"
import { insightRecord, previewField, relationField } from "./insights-test-fixtures"

jest.mock("@/app/lib/image-utils", () => ({ publicPromptImageUrl: jest.fn() }))
jest.mock("@/app/records/actions", () => ({
  getRecords: jest.fn(),
  getHistoricalRelatedRecords: jest.fn(),
  resolveRelationsForSidebar: jest.fn(),
}))

describe("InsightsTab composition", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(publicPromptImageUrl).mockReturnValue("/api/images/prompt?preview=test")
    jest.mocked(getRecords).mockResolvedValue({ records: [], error: null })
    jest.mocked(getHistoricalRelatedRecords).mockResolvedValue({ records: [], error: null })
    jest.mocked(resolveRelationsForSidebar).mockResolvedValue({ "customer-1": "Example Customer" })
  })

  it("preserves the empty state and record metadata", () => {
    render(<InsightsTab fields={[]} formData={{}} />)
    expect(screen.getByText("No data available for insights.")).toBeInTheDocument()
    expect(screen.getByText("Fill out the record fields to generate visualizations.")).toBeInTheDocument()
    expect(screen.getByText("Record Details")).toBeInTheDocument()
    expect(screen.getByText("Uncategorized")).toBeInTheDocument()
    expect(screen.getByText("Unknown")).toBeInTheDocument()
    expect(publicPromptImageUrl).not.toHaveBeenCalled()
  })

  it("keeps summary, uploaded media, generated previews, and metadata in the same order", async () => {
    const { container } = render(
      <InsightsTab
        fields={[
          previewField,
          { id: "photo", name: "Photo", type: "file" },
          { id: "document", name: "Document", type: "file" },
        ]}
        formData={{ Concept: "draft", Photo: "/uploads/photo.png", Document: "/uploads/document.pdf" }}
        description="Record summary"
        record={{ ...insightRecord(), category: { name: "Concepts" } }}
      />,
    )
    await waitFor(() => expect(getRecords).toHaveBeenCalledWith("site-1", "category-1"))
    expect([...container.querySelectorAll("section")].map(section => section.firstElementChild?.textContent)).toEqual([
      "Content Summary", "Media", "Generated Previews", "Record Details",
    ])
    expect(screen.getByText("Record summary")).toHaveClass("line-clamp-6")
    expect(screen.getByRole("img", { name: "Photo" })).toHaveAttribute("src", "/uploads/photo.png")
    expect(screen.getByText("document.pdf")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "View File" }).map(link => link.getAttribute("href"))).toEqual([
      "/uploads/photo.png", "/uploads/document.pdf",
    ])
    expect(publicPromptImageUrl).toHaveBeenCalledWith("Illustrate draft beside draft", 512, "site-1")
    expect(screen.getByRole("img", { name: "Concept" })).toHaveAttribute("src", "/api/images/prompt?preview=test")
    expect(screen.getByText("Concepts")).toBeInTheDocument()
    expect(screen.getByText(new Date(insightRecord().created_at).toLocaleString())).toBeInTheDocument()
  })

  it("passes resolved relation context through to the generated preview carousel", async () => {
    render(
      <InsightsTab
        fields={[previewField, relationField]}
        formData={{ Concept: "draft" }}
        record={insightRecord()}
        relationsData={{ Customer: "customer-1" }}
      />,
    )
    expect(await screen.findByText("Concept - Example Customer")).toBeInTheDocument()
    expect(getHistoricalRelatedRecords).toHaveBeenCalledWith("category-1", "Customer", "customer-1")
    expect(publicPromptImageUrl).toHaveBeenCalledWith("Illustrate draft beside draft", 512, "site-1")
    expect(screen.getByRole("img", { name: "draft" }).parentElement).toHaveClass("border-primary")
  })
})