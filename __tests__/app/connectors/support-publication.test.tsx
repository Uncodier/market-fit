import { fireEvent, render, screen } from "@testing-library/react"
import { ConnectorPolicyEditor } from "@/app/connectors/connector-policy-editor"
import { parseConnectorBody } from "@/app/api/connectors/contracts"
import { access, connector, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))

test("publication is opt-in, scoped to a custom label, and survives the policy BFF", () => {
  const save = jest.fn()
  render(<ConnectorPolicyEditor access={{ ...access, policy: { ...access.policy, tool_access_mode: "all", support_publication: null } }}
    siteId="site" connector={{ ...connector, toolkit_slug: "gmail" }} canManage pending={false} save={save} onChanged={jest.fn()} />)
  expect(screen.getByRole("radio", { name: /off — do not publish/i })).toBeChecked()
  fireEvent.click(screen.getByRole("radio", { name: /including anonymous/i }))
  const label = screen.getByRole("textbox", { name: "Custom Gmail label ID" })
  const button = screen.getByRole("button", { name: "Save policy" })
  fireEvent.change(label, { target: { value: "INBOX" } })
  expect(button).toBeDisabled()
  fireEvent.change(label, { target: { value: "Label_12345" } })
  fireEvent.click(button)
  const body = { site_id: "4f294f7c-e3aa-48be-869d-ea377458f3a1", expected_revision: 1, ...save.mock.calls[0][0] }
  expect(parseConnectorBody("policy", body)).toEqual(body)
  expect(body.support_publication).toEqual({ audience: "anonymous", label_id: "Label_12345" })
  expect(() => parseConnectorBody("policy", { ...body, support_publication: { audience: "anonymous", label_id: "INBOX" } })).toThrow()
})

test("an existing publication can be removed even when the underlying tool is no longer allowed", () => {
  const save = jest.fn()
  render(<ConnectorPolicyEditor access={{ ...access, policy: { ...access.policy, support_publication: { audience: "verified", label_id: "Label_15" } } }}
    siteId="site" connector={{ ...connector, toolkit_slug: "gmail" }} canManage pending={false} save={save} onChanged={jest.fn()} />)
  fireEvent.click(screen.getByRole("radio", { name: /off — do not publish/i }))
  fireEvent.click(screen.getByRole("button", { name: "Save policy" }))
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ support_publication: null }))
})