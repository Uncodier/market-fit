import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { BirthdayField } from "@/app/leads/components/BirthdayField"
import { DetailsTab } from "@/app/leads/components/DetailsTab"
import { displayBirthday, getBirthdayDraft, getBirthdayError, serializeBirthday } from "@/app/leads/components/birthday-date"
import type { Lead } from "@/app/leads/types"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("@/app/leads/components/CallConsentFields", () => ({ CallConsentFields: () => null }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const onCommit = jest.fn<Promise<void>, [string | null]>()

function open(value: string | null = null) {
  const view = render(<BirthdayField value={value} showEmpty onCommit={onCommit} />)
  fireEvent.click(screen.getByText(value ? displayBirthday(value) : "Not specified"))
  return view
}

function enter(day: string, month: string, year: string) {
  fireEvent.change(screen.getByLabelText("Birthday day"), { target: { value: day } })
  fireEvent.change(screen.getByLabelText("Birthday month"), { target: { value: month } })
  fireEvent.change(screen.getByLabelText("Birthday year"), { target: { value: year } })
}

beforeEach(() => {
  onCommit.mockReset()
  onCommit.mockResolvedValue(undefined)
})

describe("birthday date-only validation", () => {
  it("splits stored date-only and legacy timestamp values without timezone conversion", () => {
    expect(getBirthdayDraft("1987-06-15")).toEqual({ day: "15", month: "06", year: "1987" })
    expect(getBirthdayDraft("1987-06-15T00:00:00Z")).toEqual({ day: "15", month: "06", year: "1987" })
    expect(displayBirthday("1987-06-15T00:00:00Z")).toBe("15/06/1987")
    expect(displayBirthday(null)).toBe("")
  })

  it.each([
    ["29", "2", "2000", "2000-02-29"],
    ["1", "1", "0099", "0099-01-01"],
    ["31", "12", "1980", "1980-12-31"],
  ])("accepts %s/%s/%s and preserves the database format", (day, month, year, expected) => {
    const draft = { day, month, year }
    expect(getBirthdayError(draft)).toBeNull()
    expect(serializeBirthday(draft)).toBe(expected)
  })

  it.each([
    ["31", "2", "2000"], ["29", "2", "1900"], ["31", "4", "1990"],
    ["0", "1", "1990"], ["1", "13", "1990"], ["1", "0", "1990"],
    ["1", "1", "0000"], ["1", "1", "90"], ["1", "", "1990"],
    ["x", "2", "1990"], ["1", "1", "10000"],
  ])("rejects %s/%s/%s without rolling into another month", (day, month, year) => {
    const draft = { day, month, year }
    expect(getBirthdayError(draft)).not.toBeNull()
    expect(() => serializeBirthday(draft)).toThrow()
  })

  it("allows all-empty fields to clear the optional birthday", () => {
    const draft = getBirthdayDraft(null)
    expect(getBirthdayError(draft)).toBeNull()
    expect(serializeBirthday(draft)).toBeNull()
  })
})

describe("direct birthday entry", () => {
  it("shows day, month and year inputs in that order, with a numeric mobile keyboard", () => {
    const { container } = open()
    const group = screen.getByRole("group", { name: "Birthday date" })
    expect(within(group).getAllByRole("textbox").map((input) => input.getAttribute("aria-label")))
      .toEqual(["Birthday day", "Birthday month", "Birthday year"])
    for (const input of within(group).getAllByRole("textbox")) {
      expect(input).toHaveAttribute("inputmode", "numeric")
    }
    expect(screen.getByLabelText("Birthday year")).toHaveAttribute("maxlength", "4")
    expect(container.querySelector('input[type="date"]')).toBeNull()
    expect(screen.queryByText("Today")).not.toBeInTheDocument()
  })

  it("saves a historical birthday directly without calendar navigation", async () => {
    open()
    enter("5", "6", "1987")
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save birthday" }))
    await waitFor(() => expect(screen.queryByLabelText("Birthday day")).not.toBeInTheDocument())
    expect(onCommit).toHaveBeenCalledWith("1987-06-05")
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it("preloads the existing birthday and cancels without saving", () => {
    open("1987-06-15T00:00:00Z")
    expect(screen.getByLabelText("Birthday day")).toHaveValue("15")
    expect(screen.getByLabelText("Birthday month")).toHaveValue("06")
    expect(screen.getByLabelText("Birthday year")).toHaveValue("1987")
    enter("22", "8", "1990")
    fireEvent.click(screen.getByRole("button", { name: "Cancel birthday edit" }))
    expect(screen.getByText("15/06/1987")).toBeInTheDocument()
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("15/06/1987"))
    expect(screen.getByLabelText("Birthday day")).toHaveValue("15")
  })

  it("blocks incomplete entry and impossible dates, then permits correction", async () => {
    open()
    enter("31", "2", "")
    const save = screen.getByRole("button", { name: "Save birthday" })
    expect(save).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("Enter day, month and year.")
    enter("31", "2", "2000")
    expect(save).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid date.")
    fireEvent.click(save)
    fireEvent.keyDown(screen.getByLabelText("Birthday year"), { key: "Enter" })
    expect(onCommit).not.toHaveBeenCalled()
    enter("29", "2", "2000")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(save).toBeEnabled()
    fireEvent.keyDown(screen.getByLabelText("Birthday year"), { key: "Enter" })
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith("2000-02-29"))
  })

  it("clears an existing birthday only when all three parts are empty", async () => {
    open("1987-06-15")
    enter("", "06", "1987")
    expect(screen.getByRole("button", { name: "Save birthday" })).toBeDisabled()
    enter("", "", "")
    fireEvent.click(screen.getByRole("button", { name: "Save birthday" }))
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(null))
  })

  it("ignores nonnumeric characters and limits the date part lengths", () => {
    open()
    enter("1x5", "0a6", "1987abc")
    expect(screen.getByLabelText("Birthday day")).toHaveValue("15")
    expect(screen.getByLabelText("Birthday month")).toHaveValue("06")
    expect(screen.getByLabelText("Birthday year")).toHaveValue("1987")
    enter("123", "123", "12345")
    expect(screen.getByLabelText("Birthday day")).toHaveValue("12")
    expect(screen.getByLabelText("Birthday month")).toHaveValue("12")
    expect(screen.getByLabelText("Birthday year")).toHaveValue("1234")
  })

  it("cancels with Escape and avoids duplicate submissions while saving", async () => {
    let resolve!: () => void
    onCommit.mockImplementation(() => new Promise<void>((done) => { resolve = done }))
    open("1987-06-15")
    fireEvent.keyDown(screen.getByLabelText("Birthday day"), { key: "Escape" })
    expect(screen.queryByLabelText("Birthday day")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("15/06/1987"))
    fireEvent.keyDown(screen.getByLabelText("Birthday year"), { key: "Enter" })
    expect(screen.getByRole("button", { name: "Save birthday" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel birthday edit" })).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText("Birthday year"), { key: "Enter" })
    expect(onCommit).toHaveBeenCalledTimes(1)
    await act(async () => resolve())
  })

  it("keeps the draft visible if the existing save callback fails", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    try {
      onCommit.mockRejectedValueOnce(new Error("Save failed"))
      open()
      enter("15", "6", "1987")
      fireEvent.click(screen.getByRole("button", { name: "Save birthday" }))
      await waitFor(() => expect(screen.getByRole("button", { name: "Save birthday" })).toBeEnabled())
      expect(screen.getByLabelText("Birthday year")).toHaveValue("1987")
    } finally {
      consoleError.mockRestore()
    }
  })

  it("respects the existing empty-field visibility toggle", () => {
    const { rerender } = render(<BirthdayField value={null} showEmpty={false} onCommit={onCommit} />)
    expect(screen.queryByText("Birthday")).not.toBeInTheDocument()
    rerender(<BirthdayField value="1987-06-15" showEmpty={false} onCommit={onCommit} />)
    expect(screen.getByText("15/06/1987")).toBeInTheDocument()
  })
})

it("connects birthday entry to the existing lead update with a date-only value", async () => {
  const lead: Lead = {
    id: "11111111-1111-4111-8111-111111111111", name: "Test lead", email: "test@example.com",
    personal_email: null, phone: null, company_id: null, company: null, position: null,
    segment_id: null, campaign_id: null, status: "new", created_at: "2026-01-01", updated_at: "2026-01-01",
    last_contact: null, origin: null, birthday: "1987-06-15", language: null, social_networks: null,
    address: null, notes: null,
  }
  const onUpdateLead = jest.fn().mockResolvedValue(undefined)
  render(<DetailsTab lead={lead} segments={[]} campaigns={[]} showEmpty={false}
    onToggleEmpty={jest.fn()} onUpdateLead={onUpdateLead} onCallConsentSaved={jest.fn()} />)
  fireEvent.click(screen.getByText("15/06/1987"))
  enter("29", "2", "2000")
  fireEvent.click(screen.getByRole("button", { name: "Save birthday" }))
  await waitFor(() => expect(onUpdateLead).toHaveBeenCalledWith(lead.id, { birthday: "2000-02-29" }))
  expect(onUpdateLead).toHaveBeenCalledTimes(1)
})