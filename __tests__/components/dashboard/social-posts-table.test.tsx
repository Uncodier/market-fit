import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { SocialPostsTable } from "@/app/components/dashboard/social-posts-table"
import { performancePost } from "./social-fixtures"

it("sorts every post and paginates beyond the original top ten without losing metrics", () => {
  const posts = Array.from({ length: 12 }, (_, index) => ({ ...performancePost({
    id: String(index).padStart(2, "0"), views: index, comments: 12 - index,
    content: { title: `Post ${index}`, published_at: "2026-09-15T12:00:00Z" },
  }), reportedEngagementRate: index / 100 }))
  render(<SocialPostsTable posts={posts} isLoading={false} />)
  const table = screen.getByRole("table", { name: "Social post performance" })
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Post 11")
  expect(screen.queryByRole("link", { name: "Post 0" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Next posts" }))
  expect(screen.getByRole("link", { name: "Post 0" })).toBeInTheDocument()
  expect(screen.getByText(/11–12 of 12 posts/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole("combobox", { name: "Sort social posts" }), { target: { value: "comments" } })
  expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Post 0")
  expect(screen.getByText(/1–10 of 12 posts/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Post 0" })).toHaveAttribute("href", `/content/${posts[0].content_id}`)
})

it("distinguishes missing post metrics from measured zero", () => {
  render(<SocialPostsTable posts={[{
    ...performancePost({ content: { title: "Incomplete", published_at: "2026-09-15T12:00:00Z" } }),
    views: null, reach: 0, reportedEngagementRate: null,
  }]} isLoading={false} />)
  const cells = within(screen.getByRole("table")).getAllByRole("cell")
  expect(cells[2]).toHaveTextContent("—")
  expect(cells[3]).toHaveTextContent("0")
  expect(cells[4]).toHaveTextContent("—")
})