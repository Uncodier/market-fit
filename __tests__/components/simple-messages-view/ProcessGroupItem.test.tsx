import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { ProcessGroupItem } from "@/app/components/simple-messages-view/components/ProcessGroupItem"

jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
jest.mock("remark-gfm", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("remark-breaks", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "site-1" } }),
}))
jest.mock("@/app/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}))
jest.mock("@/app/records/response-record-actions", () => ({
  syncAiFeedbackRecord: jest.fn(),
  createResponseRecord: jest.fn(),
  getResponseRecordCategories: jest.fn().mockResolvedValue({ categories: [] }),
}))
jest.mock("@/app/components/simple-messages-view/components/InstanceNodeChildren", () => ({
  InstanceNodeChildren: ({ leading }: { leading: ReactNode }) => (
    <div>
      {leading}
      <button type="button">Branch to Node</button>
    </div>
  ),
}))

describe("ProcessGroupItem", () => {
  it("shows the response toolbar on the final workflow answer", () => {
    render(
      <ProcessGroupItem
        group={{
          groupId: "process-1",
          userPrompt: "What should I do next?",
          entries: [
            {
              type: "log",
              timestamp: "2026-09-15T12:00:00.000Z",
              data: {
                id: "answer-1",
                instance_id: "instance-1",
                log_type: "agent_action",
                level: "info",
                message: "Here is the final answer.",
                created_at: "2026-09-15T12:00:00.000Z",
              },
            },
          ],
        }}
        isDarkMode={false}
        isExpanded={false}
        onToggleExpand={jest.fn()}
        collapsedToolDetails={new Set()}
        onToggleToolDetails={jest.fn()}
      />,
    )

    expect(screen.getByRole("toolbar", { name: "Copy and rate this response" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark as good" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save as record" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Branch to Node" })).toBeInTheDocument()
  })
})
