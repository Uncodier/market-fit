import { StrictMode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import ConnectorCallback from "@/app/connectors/callback/connector-callback"
import { deferred, jsonResponse, translate } from "./fixtures"

let mockUser = "user-1"
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: mockUser ? { id: mockUser } : null, isLoading: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
const fetchMock = jest.mocked(fetch)
beforeEach(() => {
  fetchMock.mockReset(); mockUser = "user-1"
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("attempt_id=attempt-1&session_uri=provider-proof") as ReturnType<typeof useSearchParams>)
})

test("posts proof only once in StrictMode, strips query, and waits for server verification", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  window.history.replaceState(null, "", "/connectors/callback?session_uri=provider-proof")
  render(<StrictMode><ConnectorCallback /></StrictMode>)
  expect(window.location.search).toBe("")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe("/api/connectors/auth-attempts/attempt-1/complete")
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ session_uri: "provider-proof" })
  expect(screen.queryByText(/Authorization verified/)).not.toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse({ connector_id: "connector-1", toolkit_slug: "mail", status: "completed" })))
  expect(await screen.findByRole("link", { name: "Review account access" })).toHaveAttribute("href", "/connectors/mail?connector=connector-1")
})

test("missing attempt requires explicit selection even when there is only one pending attempt", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("session_uri=provider-proof") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ attempt_id: "attempt-1", site_id: "original-site", toolkit_slug: "mail", status: "pending" }] })).mockResolvedValueOnce(jsonResponse({ connector_id: "connector-1", toolkit_slug: "mail", status: "completed" }))
  render(<ConnectorCallback />)
  const verify = await screen.findByRole("button", { name: "Verify this attempt" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe("/api/connectors/pending-auth")
  fireEvent.click(verify)
  await screen.findByRole("link", { name: "Review account access" })
  expect(screen.getByRole("status")).toHaveTextContent(/shared with eligible workspace members and agents by default/)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test("connectedAccountId alone never proves authorization", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("attempt_id=attempt-1&connectedAccountId=forged-account&status=success") as ReturnType<typeof useSearchParams>)
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toHaveTextContent("does not include valid verification proof")
  expect(fetchMock).not.toHaveBeenCalled()
})

test("old completed or unknown attempts cannot turn a callback into false success", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("session_uri=new-proof") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: ["completed", "outcome_unknown"].map(status => ({ attempt_id: status, site_id: "site-1", toolkit_slug: "old-mail", status })) }))
  render(<ConnectorCallback />)
  expect(await screen.findByText(/No authorization attempts/)).toBeVisible()
  expect(screen.queryByRole("button", { name: "Verify this attempt" })).not.toBeInTheDocument()
  expect(screen.queryByText(/Authorization verified/)).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("actor is bound before manual selection and switching back cannot revive callback", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("session_uri=proof") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse({ items: [{ attempt_id: "attempt-1", site_id: "site-1", toolkit_slug: "mail", status: "pending" }] }))
  const view = render(<ConnectorCallback />)
  await screen.findByRole("button", { name: "Verify this attempt" })
  mockUser = "user-2"
  view.rerender(<ConnectorCallback />)
  expect(screen.getByRole("alert")).toHaveTextContent("You do not have access")
  mockUser = "user-1"
  view.rerender(<ConnectorCallback />)
  expect(screen.getByRole("alert")).toHaveTextContent("You do not have access")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("lost completion is unknown, not automatically retried or shown as successful", async () => {
  fetchMock.mockRejectedValue(new Error("network timeout"))
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toHaveTextContent("The outcome is not confirmed")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("link", { name: "Review account access" })).not.toBeInTheDocument()
})

test("identity change prevents returning a previous actor's successful account", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  const view = render(<ConnectorCallback />)
  mockUser = "user-2"
  view.rerender(<ConnectorCallback />)
  await act(async () => pending.resolve(jsonResponse({ connector_id: "connector-1", toolkit_slug: "mail", status: "completed" })))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("You do not have access"))
  expect(screen.queryByRole("link", { name: "Review account access" })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})