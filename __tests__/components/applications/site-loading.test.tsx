import { act, render, screen, waitFor } from "@testing-library/react"
import { AppsListSection } from "@/app/components/applications/AppsListSection"
import { RepositoriesSection } from "@/app/components/applications/RepositoriesSection"

let mockLoading = true
let mockCurrentId: string | null = "site"
const mockFrom = jest.fn()
const mockAbortSignal = jest.fn()
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockCurrentId ? { id: mockCurrentId } : null, isLoading: mockLoading }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams("siteId=site"),
}))
const mockClient = { from: mockFrom }
jest.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }))

beforeEach(() => {
  mockLoading = true
  mockCurrentId = "site"
  mockFrom.mockClear()
  const query = {
    select: jest.fn(), eq: jest.fn(), not: jest.fn(),
    order: jest.fn(), abortSignal: mockAbortSignal.mockReset().mockResolvedValue({ data: [], error: null }),
  }
  for (const method of [query.select, query.eq, query.not, query.order]) method.mockReturnValue(query)
  mockFrom.mockReturnValue(query)
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: true, json: async () => ({ tenants: [] }) } as Response)
})

it("defers both application lists and resumes with the same site ID", async () => {
  const children = <><AppsListSection /><RepositoriesSection /></>
  const { rerender } = render(children)
  await act(async () => {})
  expect(fetch).not.toHaveBeenCalled()
  expect(mockFrom).not.toHaveBeenCalled()
  mockLoading = false
  rerender(<><AppsListSection /><RepositoriesSection /></>)
  await waitFor(() => expect(screen.getByText('applications.noRepositoriesFound')).toBeInTheDocument())
  expect(fetch).toHaveBeenCalledTimes(1) // Only the database screen needs a tenant directory here.
  expect(mockFrom).toHaveBeenCalledTimes(1)
})

it('requests only links for distinct visible requirements, never follow-up reads for retired site rows', async () => {
  mockLoading = false
  let deliver!: (value: unknown) => void
  const repo = { id: 'r', stage: 'active', repo_url: 'https://example.test/repo', created_at: '2026-01-01', requirements: { id: 'req', title: 'Site B repo' } }
  mockAbortSignal.mockReturnValueOnce(new Promise(resolve => { deliver = resolve }))
    .mockResolvedValueOnce({ data: [repo, { ...repo, id: 'older-status' }], error: null })
  const view = render(<RepositoriesSection />)
  const first = mockAbortSignal.mock.calls[0][0] as AbortSignal
  mockCurrentId = 'site-b'
  view.rerender(<RepositoriesSection />)
  expect(first.aborted).toBe(true)
  await screen.findByText('Site B repo')
  await act(async () => deliver({ data: [{ ...repo, requirements: { id: 'foreign', title: 'Site A repo' } }], error: null }))
  expect(screen.queryByText('Site A repo')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenCalledWith('/api/applications/tenants?siteId=site-b', expect.anything())
  expect(fetch).toHaveBeenCalledWith('/api/applications/requirements-details', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ requirementIds: ['req'], includeLatestLog: false }),
  }))
})

it("does not let a URL siteId bypass the site initialization gate", async () => {
  mockCurrentId = null
  const { rerender } = render(<AppsListSection />)
  await act(async () => {})
  expect(fetch).not.toHaveBeenCalled()
  mockCurrentId = "site"
  mockLoading = false
  rerender(<AppsListSection />)
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenCalledWith("/api/applications/tenants?siteId=site&sort=newest")
})