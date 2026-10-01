import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ContentDeleteDialog } from "@/app/content/[id]/components/ContentDeleteDialog"
import type { DeleteContentResult } from "@/app/content/delete-content-types"

const open = () => fireEvent.click(screen.getByRole("button", { name: "Delete content" }))
const confirm = () => fireEvent.click(screen.getByRole("button", { name: "Delete" }))

it("does not offer Outstand deletion without linked posts", async () => {
  const onDelete = jest.fn().mockResolvedValue({ success: true })
  render(<ContentDeleteDialog linkedPostCount={0} onDelete={onDelete} />)
  open()
  expect(screen.getByRole("alertdialog", { name: "Delete Content" })).toBeInTheDocument()
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  confirm()
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: false }))
})

it("defaults to local-only deletion and resets the choice after cancelling", () => {
  const onDelete = jest.fn()
  render(<ContentDeleteDialog linkedPostCount={2} onDelete={onDelete} />)
  open()
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByText(/Only the local content will be deleted/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(screen.getByText(/Instagram and TikTok do not support deletion/)).toBeInTheDocument()
  expect(screen.getByText(/2 linked posts/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onDelete).not.toHaveBeenCalled()
  open()
  expect(screen.getByRole("checkbox")).not.toBeChecked()
})

it("passes the explicit opt-in, stays open while deleting, and prevents duplicate requests", async () => {
  let resolve!: (value: DeleteContentResult) => void
  const onDelete = jest.fn(() => new Promise<DeleteContentResult>(done => { resolve = done }))
  render(<ContentDeleteDialog linkedPostCount={1} onDelete={onDelete} />)
  open()
  fireEvent.click(screen.getByRole("checkbox"))
  confirm()
  expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: true })
  expect(screen.getByRole("alertdialog")).toHaveAttribute("aria-busy", "true")
  expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(screen.getByRole("checkbox")).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Deleting..." }))
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" })
  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  await act(async () => { resolve({ success: true }) })
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
})

it("shows deletion failures in the open modal and allows an explicit local-only choice", async () => {
  const message = "Some social posts could not be deleted. Local content was not deleted."
  const onDelete = jest.fn().mockResolvedValueOnce({ success: false, error: message }).mockResolvedValueOnce({ success: true })
  render(<ContentDeleteDialog linkedPostCount={1} onDelete={onDelete} />)
  open()
  fireEvent.click(screen.getByRole("checkbox"))
  confirm()
  expect(await screen.findByRole("alert")).toHaveTextContent(message)
  expect(screen.getByRole("checkbox")).toBeChecked()
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled())
  fireEvent.click(screen.getByRole("checkbox"))
  confirm()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(onDelete).toHaveBeenLastCalledWith({ deleteFromOutstand: false })
})

it("does not expose thrown internal errors or close the dialog on a network failure", async () => {
  const onDelete = jest.fn().mockRejectedValue(new Error("private credential"))
  render(<ContentDeleteDialog linkedPostCount={1} onDelete={onDelete} />)
  open()
  confirm()
  expect(await screen.findByRole("alert")).toHaveTextContent("Content deletion could not be confirmed")
  expect(screen.queryByText(/private credential/)).not.toBeInTheDocument()
  expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  expect(onDelete).toHaveBeenCalledTimes(1)
})