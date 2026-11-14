import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ImprentaAudienceLeadsCarousel } from "@/app/components/agents/imprenta-audience-leads-carousel"
import { getAudienceLeadsByAudienceIdPage } from "@/app/audiences/actions"
import { getLeadById } from "@/app/leads/actions"

jest.mock("@/app/audiences/actions", () => ({ getAudienceLeadsByAudienceIdPage: jest.fn() }))
jest.mock("@/app/leads/actions", () => ({ getLeadById: jest.fn() }))
jest.mock("@/app/components/agents/imprenta-lead-kanban-mini-card", () => ({
  ImprentaLeadKanbanMiniCard: ({ lead }: { lead: { id: string } }) => <div>Lead {lead.id}</div>,
  ImprentaLeadKanbanMiniCardSkeleton: () => <div>Loading lead</div>,
}))

describe("Imprenta stash carousel integration", () => {
  let intersect: IntersectionObserverCallback
  const originalObserver = global.IntersectionObserver
  beforeEach(() => {
    jest.clearAllMocks()
    global.IntersectionObserver = jest.fn((cb: IntersectionObserverCallback) => {
      intersect = cb
      return { observe: jest.fn(), disconnect: jest.fn() }
    }) as unknown as typeof IntersectionObserver
  })
  afterEach(() => { global.IntersectionObserver = originalObserver })
  const enter = () => act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))

  it("defers remote reads until visible and reuses successful page/detail caches on remount", async () => {
    jest.mocked(getAudienceLeadsByAudienceIdPage).mockResolvedValue({
      total: 1, rows: [{ id: "row-cache", audience_id: "aud-cache", lead_id: "lead-cache" }],
    })
    jest.mocked(getLeadById).mockResolvedValue({ lead: { id: "lead-cache" } } as Awaited<ReturnType<typeof getLeadById>>)
    const view = render(<ImprentaAudienceLeadsCarousel audienceId="aud-cache" siteId="site-cache" />)
    expect(getAudienceLeadsByAudienceIdPage).not.toHaveBeenCalled()
    enter()
    await screen.findByText("Lead lead-cache")
    expect(getLeadById).toHaveBeenCalledWith("lead-cache", "site-cache")
    view.unmount()
    render(<ImprentaAudienceLeadsCarousel audienceId="aud-cache" siteId="site-cache" />)
    enter()
    await screen.findByText("Lead lead-cache")
    expect(getAudienceLeadsByAudienceIdPage).toHaveBeenCalledTimes(1)
    expect(getLeadById).toHaveBeenCalledTimes(1)
  })

  it("retains total counts and local sorted sample bounds without fetching audience pages", async () => {
    jest.mocked(getLeadById).mockImplementation(async (id) => ({ lead: { id } } as Awaited<ReturnType<typeof getLeadById>>))
    render(<ImprentaAudienceLeadsCarousel audienceId="aud-sample" siteId="site-sample" totalCount={30} embeddedLeads={[
      { id: "row-2", audience_id: "aud-sample", idx: 2, lead_id: "sample-2" },
      { id: "row-1", audience_id: "aud-sample", idx: 1, lead_id: "sample-1" },
    ]} />)
    enter()
    await screen.findByText("Lead sample-1")
    expect(screen.getByText("30 leads in audience")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Next lead" }))
    await screen.findByText("Lead sample-2")
    await waitFor(() => expect(screen.getByRole("button", { name: "Next lead" })).toBeDisabled())
    expect(getAudienceLeadsByAudienceIdPage).not.toHaveBeenCalled()
  })
})
