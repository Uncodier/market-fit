import { fireEvent, render, screen } from "@testing-library/react"
import { ConnectorPolicyEditor } from "@/app/connectors/connector-policy-editor"
import { access, connector, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/connectors/provider-direct-settings", () => ({ AskStatus: () => null, useAskStatus: () => ({ status: { enabled: false, attested: false } }) }))

test("does not offer a second provider execution path through public chat", () => {
  render(<ConnectorPolicyEditor access={{ ...access, policy: { ...access.policy, tool_access_mode: "all", support_publication: null } }}
    siteId="site" connector={{ ...connector, toolkit_slug: "gmail" }} canManage pending={false} save={jest.fn()} onChanged={jest.fn()} />)
  expect(screen.queryByRole("radio", { name: /including anonymous/i })).not.toBeInTheDocument()
  expect(screen.queryByRole("textbox", { name: /Gmail label/i })).not.toBeInTheDocument()
  expect(screen.queryByText("Remove saved legacy Support publication")).not.toBeInTheDocument()
})

test("an existing publication can be removed even when the underlying tool is no longer allowed", () => {
  const save = jest.fn()
  render(<ConnectorPolicyEditor access={{ ...access, policy: { ...access.policy, support_publication: { audience: "verified", label_id: "Label_15" } } }}
    siteId="site" connector={{ ...connector, toolkit_slug: "gmail" }} canManage pending={false} save={save} onChanged={jest.fn()} />)
  fireEvent.click(screen.getByRole("checkbox", { name: "Remove saved legacy Support publication" }))
  fireEvent.click(screen.getByRole("button", { name: "Save policy" }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ support_publication: null }))
})