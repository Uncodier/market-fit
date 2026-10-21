import LocationAccessPage from "@/app/settings/location-access/page"
import { redirect } from "next/navigation"

jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

describe("temporarily hidden location assignment page", () => {
  it("redirects direct visits to Team Settings without loading operational records", () => {
    jest.clearAllMocks()
    expect(() => LocationAccessPage()).toThrow("NEXT_REDIRECT:/settings?tab=team")
    expect(redirect).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith("/settings?tab=team")
    expect(fetch).not.toHaveBeenCalled()
  })
})