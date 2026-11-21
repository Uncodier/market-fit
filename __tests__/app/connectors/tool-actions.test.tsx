import { fireEvent, render, screen, within } from "@testing-library/react"
import { ConnectorTools } from "@/app/connectors/connector-tools"
import { jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))

const scrollIntoView = jest.fn()
const fetchMock = jest.mocked(fetch)
const endpoint = "/api/connectors/catalog/mail/tools?site_id=site-1&page="
const read = { slug: "MAIL_LIST", name: "List messages", description: "List messages.", reviewed: true, action_types: ["read"] }
const multi = { ...read, slug: "MAIL_UPDATE", name: "Update messages", reviewed: false, action_types: ["read", "update"] }
const unknown = { ...read, slug: "MAIL_OTHER", name: "Other messages", action_types: [] }

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = scrollIntoView
  global.IntersectionObserver ??= jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver
})
beforeEach(() => { fetchMock.mockReset(); scrollIntoView.mockClear() })

test("groups each page under QuickNav anchors without a duplicate action filter", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [read, multi, unknown], total: 21, next_cursor: "next" }))
    .mockResolvedValueOnce(jsonResponse({ items: [unknown], total: 21, next_cursor: null }))
  render(<ConnectorTools siteId="site-1" slug="mail" />)
  const readGroup = await screen.findByRole("region", { name: "Read" })
  expect(within(readGroup).getByRole("heading", { name: read.name })).toBeVisible()
  const updateGroup = screen.getByRole("region", { name: "Update" })
  expect(within(updateGroup).getByRole("heading", { name: multi.name })).toBeVisible()
  expect(within(updateGroup).getByText("Read · Update")).toBeVisible()
  expect(screen.getByRole("heading", { name: "On this page" })).toBeInTheDocument()
  expect(screen.queryByRole("combobox", { name: "Tool action type" })).not.toBeInTheDocument()
  expect(within(screen.getByRole("region", { name: "Unclassified" })).getByRole("heading", { name: unknown.name })).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Update" }))
  expect(scrollIntoView.mock.contexts).toContain(updateGroup)
  expect(fetchMock).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByRole("heading", { name: unknown.name })
  expect(screen.queryByRole("button", { name: "Update" })).not.toBeInTheDocument()
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([endpoint + "1", endpoint + "2"])
})