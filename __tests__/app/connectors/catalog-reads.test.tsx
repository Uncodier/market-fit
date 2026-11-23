import { fireEvent, render, screen } from "@testing-library/react"
import { ConnectorPolicyEditor } from "@/app/connectors/connector-policy-editor"
import { access, connector, translate } from "./fixtures"
import type { Connector, ConnectorAccess, ToolAccessMode } from "@/app/connectors/types"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/connectors/provider-direct-settings", () => ({ AskAccessSection: () => null }))
const toggle = () => screen.getByRole("checkbox", { name: "Allow instance catalogue reads" })
const save = () => screen.getByRole("button", { name: "Save policy" })
function editor(mode: ToolAccessMode, policy: Partial<ConnectorAccess["policy"]>, account: Partial<Connector> = {}, manage = true) {
  const onSave = jest.fn()
  render(<ConnectorPolicyEditor siteId="site-1" canManage={manage} pending={false} save={onSave} onChanged={jest.fn()}
    connector={{ ...connector, enabled: true, ...account }} access={{ ...access, policy: {
      ...access.policy, tool_access_mode: mode, allowed_tools: ["MAIL_GET_LABEL"], ...policy,
    } }} />)
  if (policy.catalog_reads !== undefined) {
    const summary = screen.getByText("Catalogue and scoped reads")
    expect(summary.closest("details")).not.toHaveAttribute("open")
    fireEvent.click(summary)
  }
  return onSave
}

test.each(["all", "selected"] as const)("an existing disabled policy stays off until explicitly changed (%s)", mode => {
  const onSave = editor(mode, { catalog_reads: false })
  expect(toggle()).not.toBeChecked(); expect(save()).toBeDisabled()
  expect(screen.getByText(mode === "all" ? /including future entries/ : /among those exact IDs/)).toBeVisible()
  expect(screen.getByText(/allows scoped metrics reads only when the signed-in member, tool and requested data are authorized/)).toBeVisible()
  fireEvent.click(toggle()); fireEvent.click(save())
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ catalog_reads: true, tool_access_mode: mode, allowed_tools: ["MAIL_GET_LABEL"], allowed_hosts: ["assistant"] }))
  fireEvent.click(toggle()); expect(save()).toBeDisabled()
})

test("explicit revocation works; unrelated edits never resubmit or infer consent", () => {
  const onSave = editor("selected", { catalog_reads: true, allowed_hosts: ["direct", "assistant"] })
  expect(toggle()).toBeChecked()
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow requests for access" })); fireEvent.click(save())
  expect(onSave.mock.calls[0][0]).not.toHaveProperty("catalog_reads")
  expect(onSave.mock.calls[0][0].allowed_hosts).toEqual(["direct", "assistant"])
  fireEvent.click(toggle()); expect(save()).toBeDisabled(); expect(screen.getByRole("alert")).toHaveTextContent("Save the catalogue opt-out separately")
  fireEvent.click(save()); expect(onSave).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow requests for access" })); fireEvent.click(save())
  expect(onSave.mock.calls[1][0]).toEqual({ catalog_reads: false })
})

test("can revoke locally even with a delisted ID, stale publication selection and a revoked account", () => {
  const onSave = editor("selected", { catalog_reads:true, allowed_tools:["REMOVED_TOOL"], support_publication:{audience:"verified", label_id:"Label_15"} },
    { toolkit_slug:"gmail", verified_at:null, revocation_pending:true, provider_status:"REVOKED" })
  fireEvent.click(toggle()); expect(save()).toBeEnabled(); fireEvent.click(save()); expect(onSave).toHaveBeenCalledWith({catalog_reads:false})
})

test("never enables the instance host as a side effect of a policy save", () => {
  const onSave = editor("all", { catalog_reads: false, allowed_hosts: ["direct"] })
  expect(toggle()).toBeDisabled()
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow requests for access" })); fireEvent.click(save())
  expect(onSave.mock.calls[0][0].allowed_hosts).toEqual(["direct"])
  expect(onSave.mock.calls[0][0]).not.toHaveProperty("catalog_reads")
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow the interactive assistant" }))
  expect(toggle()).toBeEnabled(); expect(toggle()).not.toBeChecked()
})

test("does not offer legacy controls when the server does not report a legacy setting", () => {
  editor("all", {})
  expect(screen.queryByText("Catalogue and scoped reads")).not.toBeInTheDocument()
  expect(screen.queryByRole("checkbox", { name: "Allow instance catalogue reads" })).not.toBeInTheDocument()
})

test.each([{ enabled: false }, { revocation_pending: true }, { verified_at: null }])("requires an available connection (%j)", override => {
  editor("all", { catalog_reads: false }, override)
  expect(toggle()).not.toBeChecked(); expect(toggle()).toBeDisabled()
})

test("members cannot change this setting", () => {
  editor("all", { catalog_reads: true }, {}, false)
  expect(toggle()).toBeChecked(); expect(toggle()).toBeDisabled(); expect(screen.queryByRole("button", { name: "Save policy" })).not.toBeInTheDocument()
})