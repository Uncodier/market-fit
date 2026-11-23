import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ConnectorPolicyEditor } from "@/app/connectors/connector-policy-editor"
import { access, connector, deferred, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/connectors/provider-direct-settings", () => ({ AskAccessSection: () => null }))
const fetchMock = jest.mocked(fetch)
beforeEach(() => fetchMock.mockReset())
beforeAll(() => { HTMLElement.prototype.scrollIntoView ??= jest.fn() })

const reviewed = { slug: "MAIL_READ", name: "Read messages", description: "Read a message", reviewed: true }
const catalogOnly = { slug: "2MAIL_LIST", name: "List messages", description: "List a folder", reviewed: false }
const page = (items: typeof reviewed[], total: number | null = items.length, next_cursor: string | null = null) => jsonResponse({ items, total, next_cursor })
const add = () => screen.getByRole("button", { name: "Add tool" })
const save = () => screen.getByRole("button", { name: "Save policy" })
const path = "/api/connectors/catalog/mail/tools?site_id=site-1&page="

function editor(allowed_tools: string[] = []) {
  const onSave = jest.fn()
  render(<ConnectorPolicyEditor siteId="site-1" access={{ ...access, reviewed_tools: [], policy: { ...access.policy, allowed_tools } }}
    connector={connector} canManage pending={false} save={onSave} onChanged={jest.fn()} />)
  return onSave
}

test("pages and searches the whole toolkit; only selected exact IDs go into the policy", async () => {
  fetchMock.mockResolvedValueOnce(page([reviewed], 21)).mockResolvedValueOnce(page([], 21))
    .mockResolvedValueOnce(page([catalogOnly])).mockResolvedValueOnce(page([catalogOnly]))
  const onSave = editor([reviewed.slug])
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(add())
  expect(await screen.findByRole("button", { name: /MAIL_READ.*Already added/ })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByRole("button", { name: "Previous" })).toBeEnabled()
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  inbox & archive  " } })
  const result = await screen.findByRole("button", { name: /2MAIL_LIST.*Provider-listed · not reviewed/ })
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([path + "1", path + "2", path + "1&q=inbox+%26+archive"])
  expect(save()).toBeDisabled()
  fireEvent.click(result)
  expect(save()).toBeEnabled()
  fireEvent.click(add())
  expect(await screen.findByRole("button", { name: /2MAIL_LIST.*Already added/ })).toBeDisabled()
  expect(fetchMock.mock.calls[3][0]).toBe(path + "1")
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" })
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.click(save())
  expect(onSave).toHaveBeenCalledWith({ tool_access_mode: "selected", allowed_tools: [reviewed.slug, catalogOnly.slug], allowed_hosts: ["assistant"], require_approval: true, enabled: false })
  fireEvent.click(screen.getByRole("button", { name: `Remove ${catalogOnly.slug}` }))
  expect(save()).toBeDisabled()
})

test("loading, failed reads, retry and empty results leave the saved policy unchanged", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]))
  editor()
  fireEvent.click(add())
  expect(screen.getByRole("status")).toHaveTextContent("Loading tools")
  await act(async () => pending.resolve(jsonResponse({}, 503)))
  expect(await screen.findByRole("alert")).toHaveTextContent("unavailable")
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await screen.findByText("No tools listed")).toBeVisible()
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "MAIL_*" } })
  expect(await screen.findByText("No matching tools.")).toBeVisible()
  expect(screen.queryByRole("button", { name: /MAIL_\*/ })).not.toBeInTheDocument()
  expect(save()).toBeDisabled()
})

test("filters the full picker catalogue by action, retaining search and exact ID selection", async () => {
  const tagged = { ...catalogOnly, action_types: ["update"] }
  fetchMock.mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([], 22)).mockResolvedValueOnce(page([], 22))
    .mockResolvedValueOnce(page([tagged]))
  const onSave = editor()
  fireEvent.click(add())
  await screen.findByText("No tools listed")
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "labels" } })
  fireEvent.click(await screen.findByRole("button", { name: "Next" }))
  await screen.findByRole("button", { name: "Previous" })
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Tool action type" }), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: "Update" }))
  const result = await screen.findByRole("button", { name: /2MAIL_LIST.*Update.*Provider-listed · not reviewed/ })
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([path + "1", path + "1&q=labels", path + "2&q=labels", path + "1&q=labels&action=update"])
  fireEvent.click(result)
  expect(onSave).not.toHaveBeenCalled()
  fireEvent.click(save())
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ allowed_tools: [catalogOnly.slug] }))
})

test("late responses cannot replace a newer search", async () => {
  const oldPage = deferred<Response>()
  fetchMock.mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce(page([reviewed], null, "more"))
    .mockResolvedValueOnce(page([catalogOnly], null))
  editor()
  fireEvent.click(add())
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "messages" } })
  fireEvent.click(await screen.findByRole("button", { name: "Next" }))
  await waitFor(() => expect(fetchMock.mock.calls[2][0]).toBe(path + "2&q=messages"))
  expect(await screen.findByRole("button", { name: /2MAIL_LIST/ })).toBeEnabled()
  await act(async () => oldPage.resolve(page([reviewed])))
  expect(screen.queryByRole("button", { name: /MAIL_READ/ })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
})

test("at the 100 tool limit, opening the picker explains the limit without fetching", () => {
  editor(Array.from({ length: 100 }, (_, i) => `MAIL_${i}`))
  fireEvent.click(add())
  expect(screen.getByRole("status")).toHaveTextContent("You can allow up to 100 tools")
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(save()).toBeDisabled()
})