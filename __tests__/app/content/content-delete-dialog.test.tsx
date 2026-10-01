import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { ContentDeleteDialog } from "@/app/content/[id]/components/ContentDeleteDialog"
import { getContentDeletionPreview } from "@/app/content/get-content-deletion-preview"
import type { ContentDeletionPreviewResult, DeletionPreviewAccount } from "@/app/content/content-deletion-preview"
import type { DeleteContentResult } from "@/app/content/delete-content-types"

jest.mock("@/app/content/get-content-deletion-preview", () => ({ getContentDeletionPreview: jest.fn() }))

const contentId = "content-one"
const remoteName = "Delete content and linked posts"
const preview = (accounts: DeletionPreviewAccount[], linkedPostCount = 1): ContentDeletionPreviewResult => ({
  success: true,
  data: { linkedPostCount, accounts, canDeleteRemotely: accounts.length > 0 && accounts.every(account =>
    account.disposition !== "manual" && account.disposition !== "unknown") },
})
const account = (label: string, disposition: DeletionPreviewAccount["disposition"] = "remote"): DeletionPreviewAccount => ({
  label, network: label.toLowerCase(), username: "test-account", disposition,
})
const open = () => fireEvent.click(screen.getByRole("button", { name: "Delete content" }))
const ready = () => waitFor(() => expect(screen.queryByText(/Checking linked posts/)).not.toBeInTheDocument())
const selectRemote = async () => {
  await ready()
  fireEvent.click(screen.getByRole("checkbox"))
}
const renderDialog = (onDelete = jest.fn().mockResolvedValue({ success: true }), count = 1) => {
  render(<ContentDeleteDialog contentId={contentId} linkedPostCount={count} onDelete={onDelete} />)
  return onDelete
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getContentDeletionPreview).mockReset().mockResolvedValue(preview([account("X")]))
})

it("loads exact content context only when opened and offers no remote action for unlinked content", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([], 0))
  const onDelete = renderDialog(undefined, 0)
  expect(getContentDeletionPreview).not.toHaveBeenCalled()
  open()
  await ready()
  expect(getContentDeletionPreview).toHaveBeenCalledWith(contentId)
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  expect(screen.queryByText(/Instagram|TikTok/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Delete" }))
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: false }))
})

it("shows supported networks without unrelated warnings and refreshes on reopening", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("X"), account("Facebook")], 2))
  const onDelete = renderDialog(undefined, 2)
  open()
  await ready()
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByRole("checkbox")).toBeEnabled()
  expect(screen.getByText("2 linked posts")).toBeInTheDocument()
  expect(screen.getByText("X")).toBeInTheDocument()
  expect(screen.getByText("Facebook")).toBeInTheDocument()
  expect(screen.queryByText(/Instagram|TikTok|threads_delete/)).not.toBeInTheDocument()
  expect(screen.getByText(/Published posts on X and Facebook will stay online/)).toBeInTheDocument()
  expect(screen.queryByText(/will still be published/)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Delete local content" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByText(/Status and permissions are checked again/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onDelete).not.toHaveBeenCalled()
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("Instagram", "manual")]))
  open()
  await ready()
  expect(getContentDeletionPreview).toHaveBeenCalledTimes(2)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByText("Instagram")).toBeInTheDocument()
  expect(screen.queryByText("Facebook")).not.toBeInTheDocument()
})

it.each([{ networks: ["Instagram"] }, { networks: ["TikTok"] }, { networks: ["Instagram", "TikTok"] }])(
  "explains manual deletion for the actual published networks: $networks", async ({ networks }) => {
    jest.mocked(getContentDeletionPreview).mockResolvedValue(preview(networks.map(network => account(network, "manual"))))
    const onDelete = renderDialog()
    open()
    await ready()
    for (const network of networks) expect(screen.getByText(network)).toBeInTheDocument()
    if (!networks.includes("Instagram")) expect(screen.queryByText(/Instagram/)).not.toBeInTheDocument()
    if (!networks.includes("TikTok")) expect(screen.queryByText(/TikTok/)).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Combined deletion unavailable" })).toBeDisabled()
    expect(screen.getByText(/these published posts require manual deletion/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox"))
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "Delete local content" }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: false }))
  },
)

it("explains mixed support without promising a partial remote deletion", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("X"), account("Instagram", "manual")], 2))
  renderDialog(undefined, 2)
  open()
  await ready()
  expect(screen.getByText(/mixes posts with different deletion support/)).toBeInTheDocument()
  expect(screen.getByText(/supported posts will not be deleted automatically/)).toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.queryByRole("button", { name: remoteName })).not.toBeInTheDocument()
})

it("offers cancellation for scheduled Instagram/TikTok, not a misleading manual-deletion warning", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("Instagram", "scheduled"), account("TikTok", "scheduled")]))
  const onDelete = renderDialog()
  open()
  await ready()
  expect(screen.getAllByText(/Scheduled — can be cancelled/)).toHaveLength(2)
  expect(screen.getByText(/Scheduled posts on Instagram and TikTok will still be published unless cancelled/)).toBeInTheDocument()
  expect(screen.queryByText(/delete directly|manual deletion|cannot remove/)).not.toBeInTheDocument()
  const checkbox = screen.getByRole("checkbox", { name: "Also cancel scheduled posts and remove Outstand records" })
  expect(checkbox).toBeEnabled()
  fireEvent.click(checkbox)
  fireEvent.click(screen.getByRole("button", { name: "Delete content and cancel posts" }))
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: true }))
})

it.each(["unpublished", "deleted"] as const)("offers record cleanup for %s posts without claiming to remove live posts", async disposition => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("Instagram", disposition)]))
  renderDialog()
  open()
  await ready()
  expect(screen.getByRole("checkbox", { name: "Also remove linked Outstand records" })).toBeEnabled()
  expect(screen.queryByText(/manual deletion|cannot remove this publication/)).not.toBeInTheDocument()
  expect(screen.queryByText(/will stay online|will still be published/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("checkbox"))
  expect(screen.getByRole("button", { name: "Delete content and Outstand records" })).toBeEnabled()
})

it("shows the Threads permission caveat only for a published Threads target", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("Threads")]))
  renderDialog()
  open()
  await ready()
  expect(screen.getByText(/threads_delete/)).toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeEnabled()
})

it("distinguishes mixed states on the same network and groups repeated account outcomes", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([
    account("Instagram", "manual"), account("Instagram", "scheduled"), account("Instagram", "manual"),
  ], 3))
  renderDialog(undefined, 3)
  open()
  await ready()
  const list = screen.getByRole("list", { name: "Linked social post deletion options" })
  expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  expect(within(list).getByText("Instagram (2 publications)")).toBeInTheDocument()
  expect(within(list).getByText(/Scheduled/)).toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeDisabled()
})

it("does not guess support when a post's status is unknown", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("X", "unknown")]))
  renderDialog()
  open()
  await ready()
  expect(screen.getByText(/until every linked post can be verified/)).toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.queryByText(/Instagram|TikTok/)).not.toBeInTheDocument()
})

it("keeps local-only deletion available while verifying and ignores late responses after closing", async () => {
  let resolve!: (value: ContentDeletionPreviewResult) => void
  jest.mocked(getContentDeletionPreview).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const onDelete = renderDialog()
  open()
  expect(screen.getByRole("status")).toHaveTextContent("Checking linked posts")
  expect(screen.getByRole("checkbox")).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Delete local content" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  await act(async () => { resolve(preview([account("Instagram", "manual")])) })
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(onDelete).toHaveBeenCalledWith({ deleteFromOutstand: false })
})

it("uses the freshly verified links even when the editor's link count is stale", async () => {
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("TikTok", "manual")], 1))
  renderDialog(undefined, 0)
  open()
  await ready()
  expect(screen.getByText("1 linked post")).toBeInTheDocument()
  expect(screen.getByText("TikTok")).toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByRole("button", { name: "Delete local content" })).toBeEnabled()
})

it("does not overwrite a reopened dialog with the previous opening's late verification", async () => {
  let resolve!: (value: ContentDeletionPreviewResult) => void
  jest.mocked(getContentDeletionPreview).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  renderDialog()
  open()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  jest.mocked(getContentDeletionPreview).mockResolvedValue(preview([account("Instagram", "manual")]))
  open()
  await ready()
  await act(async () => { resolve(preview([account("X")])) })
  expect(screen.getByText("Instagram")).toBeInTheDocument()
  expect(screen.queryByText("X")).not.toBeInTheDocument()
  expect(screen.getByRole("checkbox")).toBeDisabled()
})

it("does not enable remote deletion when the content ID is unavailable", () => {
  render(<ContentDeleteDialog linkedPostCount={2} onDelete={jest.fn()} />)
  open()
  expect(getContentDeletionPreview).not.toHaveBeenCalled()
  expect(screen.getByRole("status")).toHaveTextContent("Unable to verify linked social posts")
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByRole("button", { name: "Delete local content" })).toBeEnabled()
})

it.each(["returned", "thrown"])("fails closed on %s verification failures without hiding local deletion", async failure => {
  if (failure === "returned") jest.mocked(getContentDeletionPreview).mockResolvedValue({ success: false, error: "Unable to verify linked social posts." })
  else jest.mocked(getContentDeletionPreview).mockRejectedValue(new Error("private credential"))
  renderDialog()
  open()
  await ready()
  expect(screen.getByRole("status")).toHaveTextContent("Remote deletion is unavailable")
  expect(screen.getByRole("checkbox")).toBeDisabled()
  expect(screen.getByRole("button", { name: "Delete local content" })).toBeEnabled()
  expect(screen.queryByText(/private credential|Instagram|TikTok/)).not.toBeInTheDocument()
})

it("stays open while deleting and prevents duplicate requests", async () => {
  let resolve!: (value: DeleteContentResult) => void
  const onDelete = renderDialog(jest.fn(() => new Promise<DeleteContentResult>(done => { resolve = done })))
  open()
  await selectRemote()
  fireEvent.click(screen.getByRole("button", { name: remoteName }))
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

it.each(["checkbox", "recovery button"])("requires a new confirmation after switching to local-only using %s", async control => {
  const onDelete = renderDialog(jest.fn().mockResolvedValueOnce({ success: false, error: "Local content was not deleted." })
    .mockResolvedValueOnce({ success: true }))
  open()
  await selectRemote()
  fireEvent.click(screen.getByRole("button", { name: remoteName }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Local content was not deleted.")
  await waitFor(() => expect(screen.getByRole("checkbox")).toBeEnabled())
  fireEvent.click(control === "checkbox" ? screen.getByRole("checkbox") : screen.getByRole("button", { name: "Switch to local-only deletion" }))
  expect(onDelete).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByText(/Outstand records will remain/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Delete local content" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(onDelete).toHaveBeenLastCalledWith({ deleteFromOutstand: false })
})

it("does not expose thrown deletion errors or close the dialog", async () => {
  const onDelete = renderDialog(jest.fn().mockRejectedValue(new Error("private credential")))
  open()
  await ready()
  fireEvent.click(screen.getByRole("button", { name: "Delete local content" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Content deletion could not be confirmed")
  expect(screen.queryByText(/private credential/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Switch to local-only deletion" })).not.toBeInTheDocument()
  expect(onDelete).toHaveBeenCalledTimes(1)
})