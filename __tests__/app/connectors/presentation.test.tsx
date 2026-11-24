import { fireEvent, render, screen } from "@testing-library/react"
import { LocalizationProvider, useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorCard } from "@/app/connectors/connector-card"
import { ConnectorLogo } from "@/app/connectors/connector-logo"
import { toolkit } from "./fixtures"

jest.unmock("next/image")

test("only labels managed OAuth sign-in, independently of connected accounts", () => {
  const card = (managed_oauth?: boolean) => <LocalizationProvider preferredLocale="en"><ConnectorCard toolkit={{ ...toolkit,
    slug: "metaads", name: "Meta Ads", managed_oauth, auth_schemes: ["OAUTH2", "API_KEY"] }} domains={{}} /></LocalizationProvider>
  const view = render(card(true))
  expect(screen.getByText("OAuth")).toBeVisible()
  expect(screen.getByRole("link", { name: "Meta Ads" })).toHaveAccessibleDescription(/Managed OAuth sign-in/)
  expect(screen.getByText("1 visible accounts")).toBeVisible()
  for (const flag of [false, undefined]) {
    view.rerender(card(flag))
    expect(screen.queryByText("OAuth")).not.toBeInTheDocument()
  }
})

function Counts() {
  const { t } = useLocalization()
  return <>
    <p>{t("connectors.resultCount", { count: 1500 })}</p>
    <p>{t("connectors.pageCount", { count: 50 })}</p>
    <p>{t("connectors.verifiedAt", { date: "Nov 19" })}</p>
    <p>{t("connectors.attemptWorkspace", { site: "Workspace A" })}</p>
  </>
}

test("real localization interpolates catalogue, tool, account and date values", () => {
  const { container } = render(<LocalizationProvider preferredLocale="en">
    <Counts /><ConnectorCard toolkit={toolkit} domains={{ messaging: "Messaging" }} />
  </LocalizationProvider>)
  for (const text of ["1500 matching toolkits", "50 toolkits on this page", "1 visible accounts",
    "12 catalogue tools · not an execution grant", "Last verified: Nov 19", "Workspace: Workspace A"]) {
    expect(screen.getByText(text)).toBeVisible()
  }
  expect(container.textContent).not.toMatch(/\{(?:count|date|site)\}/)
})

test("cards render public logos and recover to an icon when an image fails", () => {
  const { container } = render(<LocalizationProvider preferredLocale="en">
    <ConnectorCard toolkit={{ ...toolkit, logo: "https://logos.composio.dev/api/gmail" }} domains={{}} />
  </LocalizationProvider>)
  const image = screen.getByRole("img", { name: "Mail toolkit logo" })
  const link = screen.getByRole("link", { name: "Mail toolkit" })
  expect(link).toHaveAttribute("href", "/connectors/mail")
  expect(link).toContainElement(image)
  expect(link).toContainElement(screen.getByText("Workspace email"))
  expect(link).toContainElement(screen.getByText("12 catalogue tools · not an execution grant"))
  expect(link.querySelector("a,button")).toBeNull()
  expect(image).toHaveAttribute("src", "https://logos.composio.dev/api/gmail")
  expect(image).toHaveAttribute("referrerpolicy", "no-referrer")
  fireEvent.error(image)
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
  expect(container.querySelector("svg")).toBeInTheDocument()
})

test.each([null, "https://foreign.test/logo.svg", "javascript:alert(1)", "https://logos.composio.dev/api/gmail?token=private"])(
  "does not render an unsafe or missing logo (%s)", src => {
    render(<ConnectorLogo src={src} name="Gmail" />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  },
)