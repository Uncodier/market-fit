import { render, screen } from "@testing-library/react"
import { ConnectorProviderMode } from "@/app/connectors/connector-provider-mode"
import { ComposioSection } from "@/app/components/settings/ComposioSection"
import { translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/services/secrets-service", () => ({ secretsService: {} }))

test.each([
  ["platform", /platform-managed Composio credentials/],
  ["byok", /workspace Composio key \(BYOK\)/],
  [undefined, /Provider mode is not reported/],
] as const)("safely describes %s mode without assuming unknown means BYOK", (source, label) => {
  render(<ConnectorProviderMode source={source} />)
  expect(screen.getByText(label)).toBeVisible()
  expect(screen.getByText(/do not promise free usage/)).toBeVisible()
})

test("Integrations presents BYOK as optional and does not grant permissions", () => {
  render(<ComposioSection active />)
  expect(screen.getByText(/Optionally bring your own Composio API key/)).toBeVisible()
  expect(screen.getByText(/Optional workspace provider configuration, not an agent access grant/)).toBeVisible()
  expect(screen.queryByText(/Required to allow agents/)).not.toBeInTheDocument()
})