import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { SiteSelector } from "@/app/components/navigation/SiteSelector"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}))

jest.mock("@/app/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    sites: [],
    currentSite: null,
    setCurrentSite: jest.fn(),
    isLoading: false,
    refreshSites: jest.fn(),
  }),
}))

describe("SiteSelector empty wrapper state", () => {
  it("does not offer create-site when the wrapper has no sites", async () => {
    render(<SiteSelector />)

    await waitFor(() => {
      expect(screen.queryByText(/create your first project/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/add new project/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/layout.sidebar.createFirstProject/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/layout.sidebar.addNewProject/i)).not.toBeInTheDocument()
    })
  })
})
