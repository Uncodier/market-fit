import { resizeImprentaTextarea } from "@/app/components/agents/imprenta-auto-resize-textarea"
import {
  IMPRENTA_LOD_LITE_MIN_NODES,
  imprentaNodeTypeForResultMediaType,
  isLargeImprentaGraph,
} from "@/app/components/agents/imprenta-detail-mode"

describe("Imprenta card behavior", () => {
  it("keeps typical workflows in full card detail", () => {
    expect(isLargeImprentaGraph(3)).toBe(false)
    expect(isLargeImprentaGraph(IMPRENTA_LOD_LITE_MIN_NODES - 1)).toBe(false)
    expect(isLargeImprentaGraph(IMPRENTA_LOD_LITE_MIN_NODES)).toBe(true)
  })

  it("does not turn a text response into an editable prompt", () => {
    expect(imprentaNodeTypeForResultMediaType("response", "text")).toBe("response")
    expect(imprentaNodeTypeForResultMediaType("prompt", "text")).toBe("prompt")
    expect(imprentaNodeTypeForResultMediaType("response", "image")).toBe("generate-image")
  })

  it("expands the prompt textarea to its full content height", () => {
    const textarea = document.createElement("textarea")
    textarea.style.height = "60px"
    textarea.style.overflowY = "auto"
    textarea.scrollTop = 20
    Object.defineProperty(textarea, "scrollHeight", {
      configurable: true,
      value: 240,
    })

    expect(resizeImprentaTextarea(textarea)).toBe(240)
    expect(textarea.style.height).toBe("240px")
    expect(textarea.style.overflowY).toBe("hidden")
    expect(textarea.scrollTop).toBe(0)
  })
})
