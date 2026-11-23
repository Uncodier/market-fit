import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ConnectorAccessPanel } from "@/app/connectors/connector-access"
import { access, connector, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/connectors/provider-direct-settings", () => ({ AskStatus: () => null, useAskStatus: () => ({ status: { enabled: false, attested: false } }) }))
const fetchMock = jest.mocked(fetch)
beforeEach(() => fetchMock.mockReset())

test("an old Supabase policy stays selected until a mode-only change is saved", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...access, reviewed_tools: [],
    policy: { ...access.policy, allowed_tools: ["SUPABASE_CATALOG_ENTRY"], allowed_hosts: [] },
  })).mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  const changed = jest.fn()
  render(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, toolkit_slug: "supabase" }} canManage onChanged={changed} />)
  const selected = await screen.findByRole("radio", { name: "Only selected tools" })
  const all = screen.getByRole("radio", { name: "All compatible tools" })
  const save = screen.getByRole("button", { name: "Save policy" })
  expect(selected).toBeChecked()
  expect(save).toBeDisabled()
  fireEvent.click(all)
  expect(save).toBeEnabled()
  expect(screen.getByText("No tools in the separate reviewed inventory.")).toBeVisible()
  expect(screen.getByText(/including future tools.*provider decides.*read-only credential stays read-only/i)).toBeVisible()
  expect(screen.getByText(/without permission to use the connection can request approval instead of running the action/i)).toBeVisible()
  expect(screen.getByText(/Selecting a catalogue entry does not by itself authorize execution/)).toBeVisible()
  expect(screen.queryByRole("checkbox", { name: "Allow instance catalogue reads" })).not.toBeInTheDocument()
  expect(screen.queryByText("No tools allowed.")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Add tool" })).not.toBeInTheDocument()
  fireEvent.click(selected)
  expect(screen.getByText("SUPABASE_CATALOG_ENTRY")).toBeVisible()
  expect(save).toBeDisabled()
  fireEvent.click(all)
  fireEvent.click(save)
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  const [url, request] = fetchMock.mock.calls[1]
  expect(url).toBe("/api/connectors/connections/connector-1/policy")
  expect(request?.method).toBe("PATCH")
  expect(JSON.parse(request?.body as string)).toEqual({ site_id: "site-1", expected_revision: 4,
    tool_access_mode: "all", allowed_tools: ["SUPABASE_CATALOG_ENTRY"], allowed_hosts: [], require_approval: true, enabled: false })
})

test.each([true, false])("shows API-provided all mode without interpreting an empty list as a denial (manager: %s)", async canManage => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...access, can_manage: canManage,
    policy: { ...access.policy, tool_access_mode: "all", allowed_tools: [] },
    reviewed_tools: canManage ? [{ slug: "MAIL_READ", description: "Read mail" }] : [],
  }))
  render(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, can_use: true }} canManage={canManage} onChanged={jest.fn()} />)
  expect(await screen.findByText("All compatible tools")).toBeVisible()
  if (canManage) {
    expect(screen.getByRole("radio", { name: "All compatible tools" })).toBeChecked()
    expect(screen.getByText("Tools in the separate reviewed inventory: 1")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save policy" })).toBeDisabled()
  } else {
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Save policy" })).not.toBeInTheDocument()
    expect(screen.queryByText("No tools in the separate reviewed inventory.")).not.toBeInTheDocument()
  }
  expect(screen.queryByText("No tools allowed.")).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})