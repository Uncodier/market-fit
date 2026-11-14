import { act, fireEvent, render } from "@testing-library/react"
import { ImprentaLazyPreviewVideo } from "@/app/components/agents/imprenta-lazy-media"
import { imprentaVideoManager } from "@/app/lib/imprenta-video-playback"

jest.mock("@/app/lib/imprenta-thumb-cache", () => ({
  getImprentaThumbCache: () => ({
    getDisplayUrl: () => "blob:poster", status: () => "ready",
    request: jest.fn(), requestPriority: jest.fn(), onDecoded: () => () => {},
  }),
}))
jest.mock("@/app/lib/imprenta-video-playback", () => ({
  imprentaVideoManager: { acquire: jest.fn(), release: jest.fn() },
}))

describe("Imprenta stash video integration", () => {
  const originalObserver = global.IntersectionObserver
  let intersect: IntersectionObserverCallback
  beforeEach(() => {
    jest.clearAllMocks()
    global.IntersectionObserver = jest.fn((cb: IntersectionObserverCallback) => {
      intersect = cb
      return { observe: jest.fn(), disconnect: jest.fn() }
    }) as unknown as typeof IntersectionObserver
  })
  afterEach(() => { global.IntersectionObserver = originalObserver })

  it("keeps posters decoder-free until hover, then acquires/releases through the manager", () => {
    const view = render(<ImprentaLazyPreviewVideo url="/preview.mp4" scale={0.5} />)
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(view.container.querySelector("video")).toBeNull()
    expect(view.container.querySelector("img")?.getAttribute("src")).toBe("blob:poster")
    fireEvent.mouseEnter(view.container.firstChild!)
    const video = view.container.querySelector("video")!
    expect(video).not.toBeNull()
    expect(video.hasAttribute("autoplay")).toBe(false)
    expect(imprentaVideoManager.acquire).toHaveBeenCalledWith(video)
    fireEvent.mouseLeave(view.container.firstChild!)
    expect(imprentaVideoManager.release).toHaveBeenCalledWith(video)
    act(() => intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver))
    expect(video.hasAttribute("src")).toBe(false)
  })
})
