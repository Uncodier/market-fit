import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ImprentaPanel } from "@/app/components/agents/imprenta-panel"
import { useImprentaData } from "@/app/hooks/useImprentaData"
import { createClient } from "@/lib/supabase/client"
import { uploadAssetFile } from "@/app/assets/actions"
import type { InstanceNode } from "@/app/types/instance-nodes"
import type { useImprentaPanelState } from "@/app/components/agents/imprenta-panel/state"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/hooks/useImprentaData", () => ({ useImprentaData: jest.fn() }))
jest.mock("@/app/assets/actions", () => ({ uploadAssetFile: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/components/agents/imprenta-panel/view", () => ({
  ImprentaPanelView: ({ nodes, handleFileChange }: Pick<ReturnType<typeof useImprentaPanelState>, "nodes" | "handleFileChange">) => (
    <div>
      <input type="file" aria-label="Upload file" onChange={handleFileChange} />
      {nodes.map(node => <span key={node.id}>{node.prompt.text}</span>)}
    </div>
  ),
}))

const cachedNode: InstanceNode = {
  id: "existing", instance_id: "instance-a", site_id: "site-a", user_id: "user-a",
  parent_node_id: null, original_node_id: null, parent_instance_log_id: null,
  type: "prompt", status: "pending", prompt: { text: "Existing prompt" }, settings: {}, result: {},
  created_at: "2026-10-22", updated_at: "2026-10-22",
}
const uploaded: InstanceNode = {
  ...cachedNode, id: "uploaded", type: "generate-image", status: "completed",
  prompt: { text: "Photo.png" }, settings: { imprenta_source: "upload", media_type: "image" },
  result: { outputs: [{ url: "https://example.test/photo.png", type: "image" }] },
}
const cacheUploadedNode = jest.fn()
const refreshImprentaData = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  cacheUploadedNode.mockResolvedValue(undefined)
  refreshImprentaData.mockResolvedValue(undefined)
  jest.mocked(useImprentaData).mockReturnValue({
    imprentaData: { nodes: [cachedNode], contexts: [], logs: [] },
    isLoading: false, logs: [], cacheUploadedNode, refreshImprentaData,
  } as unknown as ReturnType<typeof useImprentaData>)
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() }
  jest.mocked(createClient).mockReturnValue({
    channel: () => channel, removeChannel: jest.fn(),
    auth: { getSession: async () => ({ data: { session: { user: { id: "user-a" } } } }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: uploaded, error: null }) }) }) }),
  } as unknown as ReturnType<typeof createClient>)
  jest.mocked(uploadAssetFile).mockResolvedValue({ path: "https://example.test/photo.png" })
})

it("mounts the real canvas controller and keeps a confirmed upload visible", async () => {
  render(<ImprentaPanel activeInstanceId="instance-a" />)
  expect(screen.getByText("Existing prompt")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Upload file"), {
    target: { files: [new File(["image"], "Photo.png", { type: "image/png" })] },
  })
  await waitFor(() => expect(screen.getByText("Photo.png")).toBeInTheDocument())
  expect(cacheUploadedNode).toHaveBeenCalledWith(uploaded)
  expect(screen.getByText("Existing prompt")).toBeInTheDocument()
})

it("does not add a pending upload to another canvas after navigation", async () => {
  let finish!: () => void
  cacheUploadedNode.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const { rerender } = render(<ImprentaPanel activeInstanceId="instance-a" />)
  fireEvent.change(screen.getByLabelText("Upload file"), {
    target: { files: [new File(["image"], "Photo.png", { type: "image/png" })] },
  })
  await waitFor(() => expect(cacheUploadedNode).toHaveBeenCalledTimes(1))
  jest.mocked(useImprentaData).mockReturnValue({
    imprentaData: { nodes: [], contexts: [], logs: [] }, isLoading: false,
    logs: [], cacheUploadedNode, refreshImprentaData,
  } as unknown as ReturnType<typeof useImprentaData>)
  rerender(<ImprentaPanel activeInstanceId="instance-b" />)
  await act(async () => { finish() })
  expect(screen.queryByText("Photo.png")).not.toBeInTheDocument()
})