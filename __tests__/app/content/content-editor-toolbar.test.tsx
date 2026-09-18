import React from "react"
import { render, screen } from "@testing-library/react"
import { ContentEditorToolbar } from "@/app/content/[id]/components/ContentEditorToolbar"

const editor = {
  isActive: jest.fn(() => false),
  getAttributes: jest.fn(() => ({})),
  can: jest.fn(() => ({ undo: () => false, redo: () => false })),
  chain: jest.fn(),
}

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
})
