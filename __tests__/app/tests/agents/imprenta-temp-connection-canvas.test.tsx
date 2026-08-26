import { render } from "@testing-library/react"
import { ImprentaTempConnectionCanvas } from "@/app/components/agents/imprenta-temp-connection-canvas"
import { createImprentaConnectionStore } from "@/app/lib/imprenta-connection-store"
import { createViewportStore } from "@/app/lib/imprenta-viewport-store"

describe("ImprentaTempConnectionCanvas", () => {
  it("mounts a viewport-sized canvas for the in-progress connection", () => {
    const connectionStore = createImprentaConnectionStore()
    connectionStore.set({ fromNode: "a", toX: 700, toY: 180 })
    const viewportStore = createViewportStore({
      scale: 1,
      position: { x: 0, y: 0 },
      canvasWidth: 800,
      canvasHeight: 600,
    })

    const { container } = render(
      <ImprentaTempConnectionCanvas
        connectionStore={connectionStore}
        viewportStore={viewportStore}
        positions={{ a: { x: 0, y: 0 } }}
        nodeHeights={{ a: 300 }}
        nodeW={480}
        rowH={300}
        strokeStyle="#fff"
      />
    )

    const canvas = container.querySelector("canvas")
    expect(canvas).not.toBeNull()
    expect(canvas?.getAttribute("aria-hidden")).toBe("true")
  })
})
