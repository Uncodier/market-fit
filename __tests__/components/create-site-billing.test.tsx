import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import CreateSitePage from "@/app/create-site/page"
import { useOptionalSite } from "@/app/context/SiteContext"
import { startSiteSetup } from "@/app/create-site/start-site-setup"
import { BILLING_INITIALIZATION_WARNING, BILLING_UNAVAILABLE_WARNING, BILLING_REFRESH_WAIT_MS,
  BILLING_REFRESH_WARNING } from "@/app/services/initialize-site-billing"
import type { SiteOnboardingValues } from "@/app/components/onboarding/schemas/onboarding-schema"

jest.mock("@/app/context/SiteContext", () => ({ useOptionalSite: jest.fn() }))
jest.mock("@/app/create-site/start-site-setup", () => ({
  ...jest.requireActual("@/app/create-site/start-site-setup"), startSiteSetup: jest.fn(),
}))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "00000000-0000-4000-8000-000000000001" } }) }))
jest.mock("@/app/hooks/use-prevent-refresh", () => ({ useSimpleRefreshPrevention: jest.fn() }))
jest.mock("@/app/components/ChunkErrorGuard", () => ({ reloadForNewBuild: jest.fn() }))
jest.mock("@/app/components/onboarding/site-onboarding", () => ({
  SiteOnboarding: ({ onComplete, isLoading, isSuccess }: {
    onComplete: (data: SiteOnboardingValues) => Promise<void>; isLoading: boolean; isSuccess: boolean
  }) => <div>
    <button onClick={() => void onComplete({ name: "Saved project" } as SiteOnboardingValues)}>Create project</button>
    {isLoading && <p>Saving project</p>}
    {isSuccess && <p>Project created</p>}
  </div>,
}))

const siteId = "11111111-1111-4111-8111-111111111111"
const createSite = jest.fn()
const refreshSiteBilling = jest.fn()
const fetchMock = jest.mocked(fetch)
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  createSite.mockResolvedValue({ id: siteId })
  refreshSiteBilling.mockResolvedValue(undefined)
  jest.mocked(startSiteSetup).mockResolvedValue({ status: 'unconfirmed', message: 'Background setup is unconfirmed.' })
  jest.mocked(useOptionalSite).mockReturnValue({
    createSite, refreshSiteBilling, setCurrentSite: jest.fn(), sites: [], isLoading: false,
  } as never)
  fetchMock.mockResolvedValue(response({ success: true, outcome: "initialized" }))
})

it("awaits initial billing and persisted credit refresh before success and optional setup", async () => {
  let resolve!: (value: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done }))
  render(<CreateSitePage />)
  fireEvent.click(screen.getByText("Create project"))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(screen.queryByText("Project created")).not.toBeInTheDocument()
  expect(startSiteSetup).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText("Create project"))
  expect(createSite).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(response({ success: true, outcome: "initialized" })) })
  expect(await screen.findByText("Project created")).toBeInTheDocument()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(startSiteSetup).toHaveBeenCalledWith(siteId)
  expect(refreshSiteBilling.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(startSiteSetup).mock.invocationCallOrder[0])
})

it("retains the created project on credit failure and retries only billing, never insert/setup", async () => {
  fetchMock.mockResolvedValueOnce(response({ success: false }, false))
  render(<CreateSitePage />)
  fireEvent.click(screen.getByText("Create project"))
  expect(await screen.findByRole("alert")).toHaveTextContent(BILLING_INITIALIZATION_WARNING)
  expect(screen.getByText("Project created")).toBeInTheDocument()
  expect(refreshSiteBilling).not.toHaveBeenCalled()
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByText("Create project"))
  expect(createSite).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(createSite).toHaveBeenCalledTimes(1)
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
})

it("makes missing initialization capability explicitly visible after the site insert", async () => {
  fetchMock.mockResolvedValue(response({ success: false, error: { code: "BILLING_INITIALIZATION_UNAVAILABLE", message: "private database" } }, false))
  render(<CreateSitePage />)
  fireEvent.click(screen.getByText("Create project"))
  expect(await screen.findByRole("alert")).toHaveTextContent(BILLING_UNAVAILABLE_WARNING)
  expect(screen.getByText("Project created")).toBeInTheDocument()
  expect(screen.queryByText("private database")).not.toBeInTheDocument()
})

it("shows background setup failure independently without recreating the project or replaying setup", async () => {
  jest.mocked(startSiteSetup).mockResolvedValue({ status: 'failed', message: 'Background setup failed. Review project settings.' })
  render(<CreateSitePage />)
  fireEvent.click(screen.getByText("Create project"))
  expect(await screen.findByText("Project created")).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('background setup failed.'))
  fireEvent.click(screen.getByText("Create project"))
  expect(createSite).toHaveBeenCalledTimes(1)
  expect(startSiteSetup).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it("finishes the saved-project success step when the credit refresh stalls and retries billing without inserting or relaunching", async () => {
  jest.useFakeTimers()
  try {
    refreshSiteBilling.mockReturnValueOnce(new Promise<void>(() => {}))
    render(<CreateSitePage />)
    await act(async () => { fireEvent.click(screen.getByText("Create project")) })
    expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
    expect(screen.queryByText("Project created")).not.toBeInTheDocument()
    expect(startSiteSetup).not.toHaveBeenCalled()
    await act(async () => { await jest.advanceTimersByTimeAsync(BILLING_REFRESH_WAIT_MS) })
    expect(screen.getByText("Project created")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(BILLING_REFRESH_WARNING)
    expect(createSite).toHaveBeenCalledTimes(1)
    expect(startSiteSetup).toHaveBeenCalledTimes(1)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" })) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(createSite).toHaveBeenCalledTimes(1)
    expect(startSiteSetup).toHaveBeenCalledTimes(1)
  } finally { jest.useRealTimers() }
})