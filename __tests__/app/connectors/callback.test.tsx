import { randomBytes } from "node:crypto"
import { bindTabAttempt, readTabAttempt } from "@/app/connectors/callback/tab-continuation"
import { StrictMode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import ConnectorCallback from "@/app/connectors/callback/connector-callback"
import { deferred, jsonResponse, translate } from "./fixtures"

const attemptId = "11111111-1111-4111-8111-111111111111"
const continuation = randomBytes(32).toString("hex")
let mockUser = "user-1"
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: mockUser ? { id: mockUser } : null, isLoading: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
const fetchMock = jest.mocked(fetch)
beforeEach(() => {
  sessionStorage.clear(); bindTabAttempt(attemptId, continuation)
  fetchMock.mockReset(); mockUser = "user-1"
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("session_uri=provider-proof") as ReturnType<typeof useSearchParams>)
})

test("posts proof only once in StrictMode, strips query, and waits for server verification", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  window.history.replaceState(null, "", "/connectors/callback?session_uri=provider-proof")
  render(<StrictMode><ConnectorCallback /></StrictMode>)
  expect(window.location.search).toBe("")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/connectors/auth-attempts/${attemptId}/complete`)
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ session_uri: "provider-proof", continuation })
  expect(screen.getByRole("heading", { name: "Verify connector authorization" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "Account authorization verified" })).not.toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse({ connector_id: "connector-1", toolkit_slug: "mail", status: "completed" })))
  expect(await screen.findByRole("heading", { name: "Account authorization verified" })).toBeVisible()
  expect(screen.queryByRole("heading", { name: "Verify connector authorization" })).not.toBeInTheDocument()
  expect(screen.getByRole("status")).toHaveTextContent("Robots Ask access and permissions are managed separately.")
  expect(screen.getByRole("link", { name: "Review Robots Ask access" })).toHaveAttribute("href", "/connectors/mail?connector=connector-1")
  expect(screen.getByRole("link", { name: "Back to connectors" })).toHaveAttribute("href", "/connectors")
})

test.each([`session_uri=provider-proof`, `attempt_id=${attemptId}&session_uri=provider-proof`])("an unbound tab never spends proof, even with an explicit attempt: %s", async query => {
  sessionStorage.clear()
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toBeVisible()
  expect(fetchMock).not.toHaveBeenCalled()
})

test("a live marker cannot be overwritten; a conflicting callback ID never claims the other attempt", async () => {
  const other = "22222222-2222-4222-8222-222222222222"
  expect(bindTabAttempt(other, randomBytes(32).toString("hex"))).toBe(false)
  expect(readTabAttempt()?.attempt_id).toBe(attemptId)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`attempt_id=${other}&session_uri=provider-proof`) as ReturnType<typeof useSearchParams>)
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toBeVisible()
  expect(fetchMock).not.toHaveBeenCalled()
})

test("connectedAccountId alone never proves authorization", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("attempt_id=attempt-1&connectedAccountId=forged-account&status=success") as ReturnType<typeof useSearchParams>)
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toHaveTextContent("does not include valid verification proof")
  expect(fetchMock).not.toHaveBeenCalled()
})

test("credential redirect requests only server verification even when the callback claims another account", async () => {
  const attemptId = "11111111-1111-4111-8111-111111111111"
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`credential_attempt=${attemptId}&connected_account_id=ca_foreign&status=success`) as ReturnType<typeof useSearchParams>)
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  render(<StrictMode><ConnectorCallback /></StrictMode>)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(`/api/connectors/auth-attempts/${attemptId}/complete`, expect.objectContaining({
    method: "POST", body: JSON.stringify({ hosted_credentials: true }) }))
  expect(screen.queryByRole("link", { name: "Review Robots Ask access" })).not.toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse({ connector_id: "connector-1", toolkit_slug: "example", status: "completed" })))
  expect(await screen.findByRole("link", { name: "Review Robots Ask access" })).toHaveAttribute("href", "/connectors/example?connector=connector-1")
})

test("does not verify a failed, malformed, or ambiguous credential callback", async () => {
  const valid = "11111111-1111-4111-8111-111111111111"
  for (const query of [`credential_attempt=${valid}&status=failed`, `credential_attempt=${valid}&status=success&status=failed`, `credential_attempt=${valid}&session_uri=proof`, "credential_attempt=not-an-id", `credential_attempt=${valid}&credential_attempt=${valid}`]) {
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
    const view = render(<ConnectorCallback />)
    expect(await screen.findByRole("alert")).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
    view.unmount()
  }
})

test.each(["CONNECTOR_NOT_ACTIVE", "CREDENTIAL_CHECK_UNAVAILABLE"])("%s allows an explicit credential check, never an automatic retry", async code => {
  const attemptId = "11111111-1111-4111-8111-111111111111"
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`credential_attempt=${attemptId}`) as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code } }, 409))
    .mockResolvedValueOnce(jsonResponse({ connector_id: "connector-1", toolkit_slug: "example", status: "completed" }))
  render(<StrictMode><ConnectorCallback /></StrictMode>)
  const retry = await screen.findByRole("button", { name: "Check connection again" })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.click(retry)
  expect(await screen.findByRole("link", { name: "Review Robots Ask access" })).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

test.each(["STORAGE_UNAVAILABLE", "OUTCOME_UNKNOWN", "ACCESS_DENIED", "CONNECTOR_ACCOUNT_MISMATCH"])("does not retry credential completion for %s", async code => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(`credential_attempt=${attemptId}`) as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code } }, 503))
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Check connection again" })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("lost completion is unknown, not automatically retried or shown as successful", async () => {
  fetchMock.mockRejectedValue(new Error("network timeout"))
  render(<ConnectorCallback />)
  expect(await screen.findByRole("alert")).toHaveTextContent("The outcome is not confirmed")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole("link", { name: "Review Robots Ask access" })).not.toBeInTheDocument()
})

test("identity change prevents returning a previous actor's successful account", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  const view = render(<ConnectorCallback />)
  mockUser = "user-2"
  view.rerender(<ConnectorCallback />)
  await act(async () => pending.resolve(jsonResponse({ connector_id: "connector-1", toolkit_slug: "mail", status: "completed" })))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("You do not have access"))
  expect(screen.queryByRole("link", { name: "Review Robots Ask access" })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})