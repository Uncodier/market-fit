import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { SocialDataQuality, type SocialCoverage } from "@/app/components/dashboard/social-data-quality"

const metadata: SocialCoverage = {
  postCount: 5, excludedUndatedPosts: 2, oldestFetchedAt: "2026-08-15T12:00:00Z", newestFetchedAt: "2026-09-29T12:00:00Z",
  missingFetchedAtCount: 1, missingMetricCounts: { views: 2, comments: 0 }, engagementRatePostCount: 3,
  postsWithAccountMetrics: 4, postsWithoutAccountMetrics: 1, duplicateSnapshotCount: 1, duplicateAccountRowCount: 2,
  engagementRateExplanation: "Provider rate units are not identified; observed rates only.",
}

it("explains date exclusions, coverage and actual sync timestamps without claiming unique reach", () => {
  render(<SocialDataQuality metadata={metadata} refreshing={false} refresh={jest.fn()} />)
  expect(screen.getByLabelText("Social data coverage")).toHaveTextContent("5 dated posts")
  expect(screen.getByText(/views missing for 2 posts/)).toBeInTheDocument()
  expect(screen.getByText(/2 posts without a valid publication date were excluded/)).toBeInTheDocument()
  expect(screen.getByText(/Reach is summed across posts, not unique people/)).toBeInTheDocument()
  expect(screen.getByText(/Sep 29, 2026.*UTC/)).toBeInTheDocument()
  expect(screen.getByText(/1 posts have no network breakdown/)).toBeInTheDocument()
  const disclosure = screen.getByText(/views missing for 2 posts/).closest("details")
  expect(disclosure).not.toHaveAttribute("open")
  expect(screen.getByText(/Newest stored sync/)).not.toBeVisible()
  expect(screen.getByText(/Data coverage · 5 dated posts · Incomplete metrics/)).toBeVisible()
  expect(screen.getByRole("button", { name: "Refresh report" })).toBeVisible()
})

it("reloads stored reports with a disabled refresh while pending", () => {
  const refresh = jest.fn()
  const { rerender } = render(<SocialDataQuality metadata={metadata} refreshing={false} refresh={refresh} />)
  fireEvent.click(screen.getByRole("button", { name: "Refresh report" }))
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/does not trigger a provider synchronization/)).toBeInTheDocument()
  rerender(<SocialDataQuality metadata={metadata} refreshing refresh={refresh} />)
  expect(screen.getByRole("button", { name: "Refreshing…" })).toBeDisabled()
})