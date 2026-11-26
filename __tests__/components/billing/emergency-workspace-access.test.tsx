import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { EmergencyWorkspaceAccess } from "@/app/components/billing/emergency-workspace-access"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { billingEmergencyAccessMessages } from "@/app/context/locales/billing/emergency-access"

jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: jest.fn() }))

const siteId = "11111111-1111-4111-8111-111111111111"
const nextSiteId = "22222222-2222-4222-8222-222222222222"
const refreshBilling = jest.fn()
const props = { siteId, actorId: "owner", eligibleHint: true, refreshBilling }
const fetchMock = jest.mocked(fetch)
const postResult = (status: number, data: unknown) => ({ ok: status === 200, status, json: async () => data }) as Response
const grant = { outcome: "granted", plan: "engine", ends_at: "2099-12-01T12:00:00Z" }

function setPermissions(role: string, site = siteId) {
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId: site, capabilities: { role } } as never)
}

function setLocale(locale: "en" | "es") {
  jest.mocked(useLocalization).mockReturnValue({ locale, t: (key: string, vars?: Record<string, string>) =>
    (billingEmergencyAccessMessages[locale][key as keyof typeof billingEmergencyAccessMessages.en] ?? key)
      .replace("{{date}}", vars?.date ?? ""),
  } as never)
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset()
  refreshBilling.mockResolvedValue(undefined)
  setPermissions("owner")
  setLocale("en")
})

it("does not offer a request without an owner and matching site or without a past-due hint", () => {
  setPermissions("admin")
  const view = render(<EmergencyWorkspaceAccess {...props} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  setPermissions("owner", nextSiteId)
  view.rerender(<EmergencyWorkspaceAccess {...props} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  setPermissions("owner")
  view.rerender(<EmergencyWorkspaceAccess {...props} eligibleHint={false} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  view.rerender(<EmergencyWorkspaceAccess {...props} temporaryAccessEndsAt={grant.ends_at} />)
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("requires an explicit click, sends only the selected site once, and refreshes its shared billing after server confirmation", async () => {
  setLocale("es")
  let resolve!: (response: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(done => { resolve = done }))
  render(<EmergencyWorkspaceAccess {...props} />)
  expect(fetchMock).not.toHaveBeenCalled()
  const button = screen.getByRole("button", { name: "Solicitar acceso de emergencia" })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(fetchMock.mock.calls).toEqual([["/api/billing/emergency-grace", expect.objectContaining({
    method: "POST", credentials: "same-origin", body: JSON.stringify({ site_id: siteId }),
  })]])
  expect(refreshBilling).not.toHaveBeenCalled()
  await act(async () => { resolve(postResult(200, grant)) })
  expect(refreshBilling).toHaveBeenCalledWith(siteId)
  expect(screen.getByRole("status")).toHaveTextContent("Acceso de emergencia confirmado")
  expect(screen.getByRole("status")).toHaveTextContent("2099")
})

it.each([
  [409, { error: { code: "GRACE_LIMIT_REACHED" } }, /used its emergency access allowance/],
  [409, { error: { code: "GRACE_INELIGIBLE" } }, /not eligible/],
  [503, { error: { code: "GRACE_UNAVAILABLE", message: "private" } }, /could not confirm/],
  [200, { outcome: "granted", plan: "engine", ends_at: "invalid" }, /could not confirm/],
])("does not show confirmation or refresh on a denied or unconfirmed request", async (status, body, message) => {
  fetchMock.mockResolvedValueOnce(postResult(status, body))
  render(<EmergencyWorkspaceAccess {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Request emergency access" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(message)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  expect(refreshBilling).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("retries only the billing read when a confirmed grant fails to refresh", async () => {
  fetchMock.mockResolvedValueOnce(postResult(200, { ...grant, outcome: "already_granted" }))
  refreshBilling.mockRejectedValueOnce(new Error("read timed out"))
  render(<EmergencyWorkspaceAccess {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Request emergency access" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Billing could not be refreshed")
  fireEvent.click(screen.getByRole("button", { name: "Reload billing information" }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  expect(refreshBilling).toHaveBeenCalledTimes(2)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("aborts local work and ignores a prior site's late response after switching sites", async () => {
  let resolve!: (response: Response) => void
  fetchMock.mockReturnValueOnce(new Promise<Response>(done => { resolve = done }))
  const view = render(<EmergencyWorkspaceAccess {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Request emergency access" }))
  setPermissions("owner", nextSiteId)
  view.rerender(<EmergencyWorkspaceAccess {...props} siteId={nextSiteId} />)
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await act(async () => { resolve(postResult(200, grant)) })
  expect(refreshBilling).not.toHaveBeenCalled()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Request emergency access" })).toBeEnabled()
})