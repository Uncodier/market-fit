import React from "react"
import { randomBytes } from "node:crypto"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { OpenRouterSection } from "@/app/integrations/components/OpenRouterSection"

const siteId = "00000000-0000-4000-8000-000000000001"
const secondSite = "00000000-0000-4000-8000-000000000002"
const secret = randomBytes(32).toString("hex")
const empty = { connection: null, canManage: true, rolloutEnabled: false, selectionMode: "manual", paidSelectionEnabled: false }
const connection = {
  id: secondSite, siteId, revision: 1, policyVersion: 1, credentialVersion: 1,
  status: "connected", selected: false, capabilities: { text: { mode: "manual", modelId: "vendor/model", status: "unverified", reason: "Not verified" } },
  catalogUpdatedAt: "2026-11-11T00:00:00Z", verifiedAt: null, updatedAt: "2026-11-11T00:00:00Z",
}
function response(body: unknown, status = 200) { return { ok: status === 200, status, json: async () => body } as Response }
beforeEach(() => { jest.mocked(fetch).mockReset().mockResolvedValue(response(empty)) })

it("shows an accessible form and footer skeleton until the connection loads", async () => {
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<OpenRouterSection siteId={siteId} />)
  const loading = screen.getByRole("status", { name: "Loading OpenRouter connection" })
  expect(loading).toHaveAttribute("aria-busy", "true")
  expect(loading.querySelector(".border-t .animate-pulse")).not.toBeNull()
  expect(within(loading).queryByRole("button")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("OpenRouter API key")).not.toBeInTheDocument()
  await act(async () => { finish(response(empty)) })
  expect(await screen.findByLabelText("OpenRouter API key")).toBeInTheDocument()
  expect(screen.queryByRole("status", { name: "Loading OpenRouter connection" })).not.toBeInTheDocument()
})

it("replaces the loading skeleton with error feedback and restores it on reload", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({}, 503))
  render(<OpenRouterSection siteId={siteId} />)
  await screen.findByRole("alert")
  expect(screen.queryByRole("status", { name: "Loading OpenRouter connection" })).not.toBeInTheDocument()
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole("button", { name: "Reload OpenRouter" }))
  expect(screen.getByRole("status", { name: "Loading OpenRouter connection" })).toBeInTheDocument()
  await act(async () => { finish(response(empty)) })
  await screen.findByLabelText("OpenRouter API key")
})

it("shows catalog skeletons without replacing the connection during model loading", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ ...empty, connection }))
  render(<OpenRouterSection siteId={siteId} />)
  const manage = await screen.findByRole("button", { name: "Manage models" })
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(manage)
  expect(screen.getByRole("status", { name: "Loading OpenRouter models" })).toHaveAttribute("aria-busy", "true")
  expect(screen.getByLabelText("Replace OpenRouter API key")).toBeInTheDocument()
  expect(manage).toBeDisabled()
  await act(async () => { finish(response({ catalogUpdatedAt: null, models: [] })) })
  expect(screen.queryByRole("status", { name: "Loading OpenRouter models" })).not.toBeInTheDocument()
  expect(await screen.findByRole("button", { name: "Hide models" })).toBeEnabled()
})

it.each([401, 403, 502, 503])('preserves safe initial-load feedback for HTTP %s', async status => {
  jest.mocked(fetch).mockResolvedValue(response({ error: secret }, status))
  render(<OpenRouterSection siteId={siteId} />)
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).not.toContain(secret)
  expect(alert.textContent).not.toContain('Owners and administrators can retry below')
  if (status === 401) expect(alert.textContent).toContain('session')
  if (status === 403) expect(alert.textContent).toContain('denied')
  if (status === 502) expect(alert.textContent).toContain('API request failed')
  if (status === 503) expect(alert.textContent).toContain('service is temporarily unavailable')
})

it('identifies backend connection failures without blaming owner permissions', async () => {
  jest.mocked(fetch).mockResolvedValue({ ...response({}, 502), headers: new Headers({ 'X-OpenRouter-Error': 'api_unavailable' }) })
  render(<OpenRouterSection siteId={siteId} />)
  expect((await screen.findByRole('alert')).textContent).toContain('not a site-role denial')
})

it('keeps raw network errors out of initial-load feedback', async () => {
  jest.mocked(fetch).mockRejectedValue(new Error(secret))
  render(<OpenRouterSection siteId={siteId} />)
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).not.toContain(secret)
  expect(alert.textContent).toContain('does not necessarily indicate a permissions problem')
})

it("requires explicit shared-account consent, clears the key, and never activates on connect", async () => {
  render(<OpenRouterSection siteId={siteId} />)
  const button = await screen.findByRole("button", { name: "Connect OpenRouter" })
  const form = (button as HTMLButtonElement).form
  expect(form).not.toBeNull()
  expect(form).not.toContainElement(button)
  const footer = button.closest(".border-t")
  expect(footer).toHaveClass("justify-end", "flex-wrap")
  expect(footer?.parentElement).toHaveAttribute("id", "openrouter-integration")
  fireEvent.change(screen.getByLabelText("OpenRouter API key"), { target: { value: secret } })
  expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox"))
  jest.mocked(fetch).mockResolvedValueOnce(response({ ...empty, connection }))
  fireEvent.click(button)
  await screen.findByText("OpenRouter configuration saved.")
  expect(screen.getByLabelText("Replace OpenRouter API key")).toHaveValue("")
  const body = JSON.parse(jest.mocked(fetch).mock.calls[1][1]?.body as string)
  expect(body).toEqual({ operation: "connect", siteId, expectedRevision: 0, consent: true, apiKey: secret })
  expect(screen.getByRole("button", { name: "Use BYOK for this site" })).toBeDisabled()
  expect(screen.getByText(/Saved credentials and models do not change/)).toBeInTheDocument()
})

it("does not show management footer actions for a read-only connection", async () => {
  jest.mocked(fetch).mockResolvedValue(response({ ...empty, connection, canManage: false }))
  render(<OpenRouterSection siteId={siteId} />)
  await screen.findByText(/Connection: connected/)
  for (const name of ["Replace key", "Refresh capabilities", "Manage models", "Use BYOK for this site", "Disconnect"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  }
})

it("refreshes with the exact revision and preserves server pins", async () => {
  jest.mocked(fetch).mockResolvedValue(response({ ...empty, connection }))
  render(<OpenRouterSection siteId={siteId} />)
  fireEvent.click(await screen.findByRole("button", { name: "Refresh capabilities" }))
  await screen.findByText("Capabilities refreshed. Manual choices were preserved.")
  expect(JSON.parse(jest.mocked(fetch).mock.calls[1][1]?.body as string)).toEqual({ operation: "refresh", siteId, expectedRevision: 1 })
})

it("loads account models and saves an exact manual choice rather than a free-form override", async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ ...empty, connection }))
  render(<OpenRouterSection siteId={siteId} />)
  jest.mocked(fetch).mockResolvedValueOnce(response({ catalogUpdatedAt: null, models: [{ id: "vendor/new", name: "New model", inputModalities: ["text"], outputModalities: ["text"], supportedParameters: [], contextLength: 10000 }] }))
  fireEvent.click(await screen.findByRole("button", { name: "Manage models" }))
  const select = await screen.findByLabelText("Selected model")
  expect(select).toHaveValue("vendor/model")
  fireEvent.change(select, { target: { value: "vendor/new" } })
  jest.mocked(fetch).mockResolvedValueOnce(response({ ...empty, connection: { ...connection, revision: 2 } }))
  fireEvent.click(screen.getByRole("button", { name: "Save text conversation" }))
  await screen.findByText("OpenRouter configuration saved.")
  expect(JSON.parse(jest.mocked(fetch).mock.calls[2][1]?.body as string)).toEqual({ operation: "configure", siteId, expectedRevision: 1, capabilities: { text: { mode: "manual", modelId: "vendor/new" } } })
})

it("asks before disconnect and never replays an ambiguous failure", async () => {
  jest.mocked(fetch).mockResolvedValue(response({ ...empty, connection }))
  render(<OpenRouterSection siteId={siteId} />)
  fireEvent.click(await screen.findByRole("button", { name: /^Disconnect$/ }))
  expect(fetch).toHaveBeenCalledTimes(1)
  jest.mocked(fetch).mockRejectedValueOnce(new Error(secret))
  fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  // Provider/transport errors must never render arbitrary credential-bearing text.
  await waitFor(() => expect(screen.getByRole("button", { name: "Reload OpenRouter" })).toBeInTheDocument())
  expect(document.body.textContent).not.toContain(secret)
})

it("clears credentials, consent and old responses when switching sites", async () => {
  const view = render(<OpenRouterSection siteId={siteId} />)
  fireEvent.change(await screen.findByLabelText("OpenRouter API key"), { target: { value: secret } })
  fireEvent.click(screen.getByRole("checkbox"))
  view.rerender(<OpenRouterSection siteId={secondSite} />)
  expect(await screen.findByLabelText("OpenRouter API key")).toHaveValue("")
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining(secondSite), expect.any(Object))
})

it("does not publish an old site's completed mutation into a new site", async () => {
  const view = render(<OpenRouterSection siteId={siteId} />)
  fireEvent.change(await screen.findByLabelText("OpenRouter API key"), { target: { value: secret } })
  fireEvent.click(screen.getByRole("checkbox"))
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole("button", { name: "Connect OpenRouter" }))
  view.rerender(<OpenRouterSection siteId={secondSite} />)
  await screen.findByRole("button", { name: "Connect OpenRouter" })
  finish(response({ ...empty, connection }))
  await waitFor(() => expect(screen.getByLabelText("OpenRouter API key")).toHaveValue(""))
  expect(screen.queryByText("OpenRouter configuration saved.")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Manage models" })).not.toBeInTheDocument()
})