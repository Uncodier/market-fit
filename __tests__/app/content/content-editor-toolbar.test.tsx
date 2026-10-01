import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { Editor } from "@tiptap/react"
import { ContentEditorToolbar } from "@/app/content/[id]/components/ContentEditorToolbar"
import { getContentDeletionPreview } from "@/app/content/get-content-deletion-preview"

jest.mock("@/app/content/get-content-deletion-preview", () => ({ getContentDeletionPreview: jest.fn() }))

const editor = {
  isActive: jest.fn(() => false),
  getAttributes: jest.fn(() => ({})),
  can: jest.fn(() => ({ undo: () => false, redo: () => false })),
  chain: jest.fn(),
} as unknown as Editor

describe("ContentEditorToolbar", () => {
  it("keeps an accessible name on the icon-only delete trigger", () => {
    render(
      <ContentEditorToolbar
        editor={editor}
        instructionsEditor={editor}
        onSave={jest.fn()}
        isSaving={false}
        onDelete={jest.fn()}
        activeTab="copy"
        hasChanges={false}
        contentType="blog_post"
        isEditorFocused={false}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Delete content" }),
    ).toBeInTheDocument()
  })

  it("passes the content ID to the contextual deletion dialog", async () => {
    jest.mocked(getContentDeletionPreview).mockResolvedValue({ success: true, data: {
      linkedPostCount: 0, accounts: [], canDeleteRemotely: false,
    } })
    render(<ContentEditorToolbar editor={editor} instructionsEditor={editor}
      onSave={jest.fn()} isSaving={false} onDelete={jest.fn()} activeTab="copy"
      hasChanges={false} contentId="content-one" linkedPostCount={1} />)
    fireEvent.click(screen.getByRole("button", { name: "Delete content" }))
    await waitFor(() => expect(getContentDeletionPreview).toHaveBeenCalledWith("content-one"))
    await waitFor(() => expect(screen.queryByRole("checkbox")).not.toBeInTheDocument())
  })
})
