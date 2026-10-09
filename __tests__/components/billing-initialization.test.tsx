import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { BillingInitialization } from "@/app/billing/billing-initialization"
import { useSite } from "@/app/context/SiteContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { BILLING_INITIALIZATION_WARNING, BILLING_REFRESH_WARNING } from "@/app/services/initialize-site-billing"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => '' }) }))

const siteId = "11111111-1111-4111-8111-111111111111"
const refreshSiteBilling = jest.fn()
const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response

function permission(role: string, update = true) {
  jest.mocked(useOptionalPermissions).mockReturnValue({
    siteId, capabilities: { role, is_owner: role === "owner", update },
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = fetchMock
  refreshSiteBilling.mockResolvedValue(undefined)
  jest.mocked(useSite).mockReturnValue({ refreshSiteBilling } as never)
  permission("owner")
  fetchMock.mockResolvedValue(response({ success: true, outcome: "already_initialized" }))
})

it("offers explicit manager recovery for an existing saved site without auto-granting on access", async () => {
  const view = render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toHaveTextContent("without recreating")
  fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" }))
  await waitFor(() => expect(refreshSiteBilling).toHaveBeenCalledWith(siteId))
  view.rerender(<BillingInitialization siteId={siteId} hasBilling />)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it.each([["collaborator", true], ["marketing", true], ["admin", false]])("cannot offer privileged recovery for %s/update=%s", (role, update) => {
  permission(role as string, update as boolean)
  render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  expect(screen.getByRole("alert")).toHaveTextContent("owner or admin")
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("keeps explicit failure feedback and allows an idempotent retry", async () => {
  fetchMock.mockResolvedValueOnce(response({ success: false }, false))
  render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(BILLING_INITIALIZATION_WARNING)
  expect(refreshSiteBilling).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" }))
  await waitFor(() => expect(refreshSiteBilling).toHaveBeenCalledWith(siteId))
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("distinguishes a stale credit read from a failed grant in user-visible feedback", async () => {
  refreshSiteBilling.mockRejectedValue(new Error("Private read failure"))
  render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  fireEvent.click(screen.getByRole("button", { name: "Retry billing setup" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(BILLING_REFRESH_WARNING)
  expect(screen.queryByText("Private read failure")).not.toBeInTheDocument()
})

it("prevents double submissions during a pending billing confirmation", async () => {
  let resolve!: (value: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(done => { resolve = done }))
  render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  const button = screen.getByRole("button", { name: "Retry billing setup" })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(screen.getByRole("status")).toHaveTextContent("Confirming billing setup")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(response({ success: true, outcome: "already_initialized" })) })
})

it("does not offer initialization for a demo or a site with loaded billing", () => {
  const view = render(<BillingInitialization siteId="demo-test" hasBilling={false} />)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  view.rerender(<BillingInitialization siteId={siteId} hasBilling />)
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("offers only read recovery, not credit initialization, when billing could not be loaded", async () => {
  permission('collaborator')
  const view = render(<BillingInitialization siteId={siteId} hasBilling={false} billingReadFailed />)
  expect(screen.getByRole('alert')).toHaveTextContent('does not mean your subscription is unpaid')
  expect(screen.queryByRole('button', { name: 'Retry billing setup' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading billing' }))
  await waitFor(() => expect(refreshSiteBilling).toHaveBeenCalledWith(siteId))
  view.rerender(<BillingInitialization siteId={siteId} hasBilling />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(refreshSiteBilling).toHaveBeenCalledWith(siteId)
  expect(fetchMock).not.toHaveBeenCalled()
})

it("keeps a failed billing read retryable without exposing diagnostics or granting credits", async () => {
  refreshSiteBilling.mockRejectedValueOnce(new Error('Private read diagnostic'))
  const view = render(<BillingInitialization siteId={siteId} hasBilling={false} billingReadFailed />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading billing' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('payment status has not changed')
  expect(screen.queryByText('Private read diagnostic')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading billing' }))
  await waitFor(() => expect(refreshSiteBilling).toHaveBeenCalledTimes(2))
  view.rerender(<BillingInitialization siteId={siteId} hasBilling />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("clears a stale initialization failure once existing paid billing is loaded", async () => {
  fetchMock.mockResolvedValueOnce(response({ success: false }, false))
  const view = render(<BillingInitialization siteId={siteId} hasBilling={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retry billing setup' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(BILLING_INITIALIZATION_WARNING)
  view.rerender(<BillingInitialization siteId={siteId} hasBilling />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})