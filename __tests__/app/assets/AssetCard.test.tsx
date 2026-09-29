import { act, render, screen } from "@testing-library/react"
import { AssetCard } from "@/app/assets/components/AssetCard"
import type { AssetWithThumbnail } from "@/app/assets/components/asset-utils"

jest.mock("@/app/assets/actions", () => ({ deleteAsset: jest.fn() }))

describe("AssetCard", () => {
  it("shows a loading placeholder before rendering a text asset preview", async () => {
    const asset: AssetWithThumbnail = {
      id: "asset-1",
      name: "notes.txt",
      description: null,
      file_path: "https://example.com/notes.txt",
      file_type: "text/plain",
      file_size: 20,
      metadata: null,
      is_public: false,
      site_id: "site-1",
      user_id: "user-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      tags: [],
    }
    const response = { ok: true, text: jest.fn().mockResolvedValue("Sample asset content") }
    let resolveFetch!: (value: typeof response) => void
    const pendingResponse = new Promise<typeof response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockReturnValue(pendingResponse)

    render(<AssetCard asset={asset} onDelete={jest.fn()} />)

    expect(await screen.findByText("Loading content...")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(asset.file_path)

    await act(async () => {
      resolveFetch(response)
    })

    expect(screen.getByText("Sample asset content")).toBeInTheDocument()
    expect(screen.queryByText("Loading content...")).not.toBeInTheDocument()
  })
})