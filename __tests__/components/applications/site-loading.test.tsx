import { act, render, waitFor } from "@testing-library/react"
import { AppsListSection } from "@/app/components/applications/AppsListSection"
import { RepositoriesSection } from "@/app/components/applications/RepositoriesSection"

let mockLoading = true
let mockCurrentId: string | null = "site"
const mockFrom = jest.fn()
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
    order: jest.fn(async () => ({ data: [], error: null })),
  }
  for (const method of [query.select, query.eq, query.not]) method.mockReturnValue(query)
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
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  expect(mockFrom).toHaveBeenCalledTimes(1)
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