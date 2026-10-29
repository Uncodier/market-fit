import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { VisitTimezoneField } from "@/app/visits/components/VisitTimezoneField"
import { timezoneOptions } from "@/lib/calendar/timezone-options"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ locale: "en" }) }))
jest.mock("@/lib/calendar/timezone", () => ({
  ...jest.requireActual("@/lib/calendar/timezone"), browserTimeZone: () => "UTC",
}))

it("finds countries in English and Spanish, regions, and valid saved aliases", () => {
  const options = timezoneOptions("Asia/Calcutta", "en")
  const search = (query: string) => options.filter(option => option.searchText.toLowerCase().includes(query.toLowerCase())).map(option => option.value)
  expect(search("México")).toContain("America/Mexico_City")
  expect(search("Spain")).toEqual(expect.arrayContaining(["Europe/Madrid", "Atlantic/Canary", "Africa/Ceuta"]))
  expect(search("España")).toContain("Europe/Madrid")
  expect(search("Baja California")).toContain("America/Tijuana")
  expect(search("California")).toContain("America/Los_Angeles")
  expect(options.find(option => option.value === "Asia/Calcutta")?.label).toContain("India")
  expect(new Set(options.map(option => option.value)).size).toBe(options.length)
})

it("changes visit timestamp display by country/region without altering the source instant", async () => {
  render(<VisitTimezoneField startTime="2026-10-29T15:00:00.000Z" endTime="2026-10-29T16:00:00.000Z" />)
  await waitFor(() => expect(screen.getByTestId("visit-zoned-time")).toHaveTextContent("2026-10-29 15:00"))
  fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "Mexico City" } })
  fireEvent.click(screen.getByText(/Mexico.*America\/Mexico City/))
  expect(screen.getByTestId("visit-zoned-time")).toHaveTextContent("2026-10-29 09:00")
  expect(screen.getByTestId("visit-zoned-time")).toHaveTextContent("2026-10-29 10:00")
  fireEvent.change(screen.getByLabelText("Time zone"), { target: { value: "España" } })
  fireEvent.click(screen.getByText(/Spain.*Europe\/Madrid/))
  expect(screen.getByTestId("visit-zoned-time")).toHaveTextContent("2026-10-29 16:00")
})