import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { SupportedLocale } from "@/app/context/LocalizationContext"
import { ProfilePreferences } from "@/app/profile/components/ProfilePreferences"

jest.mock("@/app/context/LocalizationContext", () => ({
  ...jest.requireActual("@/app/context/LocalizationContext"),
  useLocalization: jest.fn(),
}))

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

const setLocale = jest.fn()

function mockLocale(locale: SupportedLocale) {
  jest.mocked(useLocalization).mockReturnValue({
    locale,
    isReady: true,
    setLocale,
    applyUnresolvedLocale: jest.fn(),
    t: key => key,
    getAsset: key => key,
  })
}

function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" })
  fireEvent.click(screen.getByRole("option", { name: option }))
}

describe("profile language preferences", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: jest.fn() })
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: jest.fn(() => false) })
    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: jest.fn() })
  })

  afterAll(() => {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
    Reflect.deleteProperty(HTMLElement.prototype, "hasPointerCapture")
    Reflect.deleteProperty(HTMLElement.prototype, "releasePointerCapture")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockLocale("en")
  })

  it.each([undefined, "", "unsupported"])("falls back to the active UI locale for language %s", language => {
    mockLocale("fr")
    const updateProfile = jest.fn()
    render(<ProfilePreferences profile={{ language }} updateProfile={updateProfile} isUpdating={false} />)

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("French")
    expect(updateProfile).not.toHaveBeenCalled()
    expect(setLocale).not.toHaveBeenCalled()
  })

  it("uses the active locale when no profile exists", () => {
    render(<ProfilePreferences profile={null} updateProfile={jest.fn()} isUpdating={false} />)

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")
  })

  it.each([
    ["es", "Spanish"],
    ["fr-CA", "French"],
    ["de-DE", "German"],
    ["ja-JP", "Japanese"],
  ])("shows the normalized stored language %s instead of the fallback", (language, label) => {
    render(<ProfilePreferences profile={{ language }} updateProfile={jest.fn()} isUpdating={false} />)

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent(label)
  })

  it("updates a missing-language fallback when the active UI locale resolves", () => {
    const profile = {}
    const updateProfile = jest.fn()
    const { rerender } = render(<ProfilePreferences profile={profile} updateProfile={updateProfile} isUpdating={false} />)
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("English")

    mockLocale("ja")
    rerender(<ProfilePreferences profile={profile} updateProfile={updateProfile} isUpdating={false} />)
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Japanese")
  })

  it("submits the selected language and existing timezone without applying locale in the UI", async () => {
    const updateProfile = jest.fn().mockResolvedValue(true)
    render(<ProfilePreferences profile={{ timezone: "Europe/London" }} updateProfile={updateProfile} isUpdating={false} />)

    choose("Language", "Japanese")
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Japanese")
    expect(updateProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ language: "ja", timezone: "Europe/London" }, true))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Preferences updated successfully"))
    expect(setLocale).not.toHaveBeenCalled()
  })

  it("submits the normalized persisted language when preferences are unchanged", async () => {
    const updateProfile = jest.fn().mockResolvedValue(true)
    render(<ProfilePreferences profile={{ language: "de-DE" }} updateProfile={updateProfile} isUpdating={false} />)

    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }))

    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ language: "de", timezone: "America/Mexico_City" }, true))
  })

  it("keeps the draft and reports failed saves without changing the active locale", async () => {
    const updateProfile = jest.fn().mockResolvedValue(false)
    render(<ProfilePreferences profile={null} updateProfile={updateProfile} isUpdating={false} />)

    choose("Language", "Spanish")
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to update preferences"))
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Spanish")
    expect(toast.success).not.toHaveBeenCalled()
    expect(setLocale).not.toHaveBeenCalled()
  })

  it("disables saving while the profile is updating", () => {
    const updateProfile = jest.fn()
    render(<ProfilePreferences profile={null} updateProfile={updateProfile} isUpdating />)

    fireEvent.click(screen.getByRole("button", { name: "Saving..." }))
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled()
    expect(updateProfile).not.toHaveBeenCalled()
  })
})