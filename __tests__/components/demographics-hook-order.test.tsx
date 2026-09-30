import React from "react"
import { render, screen } from "@testing-library/react"
import { DemographicsTab } from "@/app/segments/[id]/components/icpTabs/DemographicsTab"
import { useTheme } from "@/app/context/ThemeContext"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: jest.fn(() => ({ isDarkMode: false })) }))
jest.mock("@/app/components/WorldMapLazy", () => ({ __esModule: true, default: () => null }))
jest.mock("@/app/segments/[id]/components/icpTabs/DemographicGender", () => ({ DemographicGender: () => null }))

it("reads theme on both empty and populated demographic renders", () => {
  const { rerender } = render(<DemographicsTab icpProfile={null} />)
  expect(screen.getByText("No profile data available")).toBeInTheDocument()
  expect(useTheme).toHaveBeenCalledTimes(1)
  rerender(<DemographicsTab icpProfile={{ id: "profile-1", name: "Test", description: "", demographics: {} }} />)
  expect(screen.getByText("Age Range")).toBeInTheDocument()
  expect(useTheme).toHaveBeenCalledTimes(2)
  rerender(<DemographicsTab icpProfile={null} />)
  expect(screen.getByText("No profile data available")).toBeInTheDocument()
  expect(useTheme).toHaveBeenCalledTimes(3)
})