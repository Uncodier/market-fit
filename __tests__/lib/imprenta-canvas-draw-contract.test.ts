import { drawLiteNode, imprentaCanvasTheme, type DrawLiteNodeInputs } from "@/app/lib/imprenta-canvas-draw"
import type { ImprentaThumbCache } from "@/app/lib/imprenta-thumb-cache"

function canvasContext() {
  return {
    fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
    save: jest.fn(), restore: jest.fn(), beginPath: jest.fn(), closePath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(), quadraticCurveTo: jest.fn(), clip: jest.fn(),
    fill: jest.fn(), stroke: jest.fn(), fillRect: jest.fn(), strokeRect: jest.fn(),
    arc: jest.fn(), drawImage: jest.fn(), measureText: jest.fn(() => ({ width: 5 })),
  }
}

describe("Imprenta canvas drawing after extraction", () => {
  it("uses the dimensions of cached canvas thumbnails in the media-result path", () => {
    const image = document.createElement("canvas")
    image.width = 200
    image.height = 100
    const cache: ImprentaThumbCache = {
      get: jest.fn(() => image), getDisplayUrl: () => null, status: () => "ready",
      request: jest.fn(), requestPriority: jest.fn(), touch: jest.fn(),
      onDecoded: () => () => {}, clear: jest.fn(), size: () => 1,
    }
    const ctx = canvasContext()
    const params: DrawLiteNodeInputs = {
      node: {
        id: "node-1", instance_id: "instance-1", parent_node_id: null, original_node_id: null,
        parent_instance_log_id: null, type: "generate-image", status: "completed",
        result: { image_url: "/cover.png" }, settings: {}, prompt: {}, site_id: "site-1",
        user_id: "user-1", created_at: "2026-09-01", updated_at: "2026-09-01",
      },
      x: 10, y: 20, w: 100, h: 100, scale: 1, band: "micro",
      theme: imprentaCanvasTheme(false), coverImageUrl: "/cover.png", coverVideoUrl: null,
      extraImageUrls: [], thumbs: cache, drawLabel: false,
    }
    drawLiteNode(ctx as unknown as CanvasRenderingContext2D, params)
    expect(cache.get).toHaveBeenCalledWith("/cover.png")
    expect(ctx.drawImage).toHaveBeenCalledWith(image, -36, 22, 192, 96)
    expect(cache.requestPriority).not.toHaveBeenCalled()
  })
})