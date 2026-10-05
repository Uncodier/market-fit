import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { useRouter } from "next/navigation"
import ContentDetailPage from "@/app/content/[id]/content-item-client"
import { useContentItemController } from "@/app/content/[id]/hooks/use-content-item-controller"
import { ContentRightPanel } from "@/app/content/[id]/components/ContentRightPanel"

jest.mock("@/app/content/[id]/hooks/use-content-item-controller", () => ({ useContentItemController: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/assets/actions", () => ({ createAsset: jest.fn() }))
jest.mock("@/app/components/upload-asset-dialog", () => ({ UploadAssetDialog: () => null }))
jest.mock("@/app/content/[id]/components/ContentEditorPane", () => ({ ContentEditorPane: () => <div>Editor loaded</div> }))
jest.mock("@/app/content/[id]/components/ContentPublishDialog", () => ({ ContentPublishDialog: () => null }))
jest.mock("@/app/content/[id]/components/ContentAiPanel", () => ({ ContentAiPanel: () => null }))
jest.mock("@/app/content/[id]/components/ContentDetailsPanel", () => ({ ContentDetailsPanel: () => null }))
jest.mock("@/app/content/components/ContentPerformancePanel", () => ({ ContentPerformancePanel: () => null }))

const controller = jest.mocked(useContentItemController)
const loadContent = jest.fn()
const push = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(React, "use").mockReturnValue({ id: "one" })
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
})
afterEach(() => jest.restoreAllMocks())

function setController(values: Record<string, unknown>) {
  controller.mockReturnValue({ isLoading: false, content: null, loadError: null, loadContent, ...values } as unknown as ReturnType<typeof useContentItemController>)
}

it("renders the error state instead of crashing and supports explicit retry/back", () => {
  setController({ loadError: "Unable to load this content. Check your connection and try again." })
  render(<ContentDetailPage params={Promise.resolve({ id: "one" })} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Content unavailable")
  expect(screen.queryByText("Editor loaded")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(loadContent).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Back to Content" }))
  expect(push).toHaveBeenCalledWith("/content")
})

it.each([null, { id: "previous-id" }])("blocks missing or stale content even without a load error", content => {
  setController({ content })
  render(<ContentDetailPage params={Promise.resolve({ id: "one" })} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Content not found")
  expect(screen.queryByText("Editor loaded")).not.toBeInTheDocument()
})

it("renders the editor normally for the current content", () => {
  setController({ content: { id: "one", title: "Test", tags: [] }, hasUnsavedChanges: () => false })
  render(<ContentDetailPage params={Promise.resolve({ id: "one" })} />)
  expect(screen.getByText("Editor loaded")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("makes the right panel safe when called with null content", () => {
  const { container } = render(<ContentRightPanel {...{ content: null } as React.ComponentProps<typeof ContentRightPanel>} />)
  expect(container).toBeEmptyDOMElement()
})