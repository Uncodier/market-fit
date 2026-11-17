import { act, render } from "@testing-library/react"
import { useImprentaMeasurement } from "@/app/components/agents/imprenta-panel/measurement"
import type { InstanceNode } from "@/app/types/instance-nodes"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))

it("observes initially mounted cards and uses the latest layout after resize", () => {
  let onResize!: ResizeObserverCallback
  const observe = jest.fn()
  const disconnect = jest.fn()
  const originalObserver = global.ResizeObserver
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) { onResize = callback }
    observe = observe
    unobserve = jest.fn()
    disconnect = disconnect
  }
  let frame!: FrameRequestCallback
  const raf = jest.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1 })
  const cancel = jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {})
  const nodes = [{ id: "node", type: "prompt" } as InstanceNode]
  const setPositions = jest.fn()
  const options: Parameters<typeof useImprentaMeasurement>[0] = {
    nodes, dummyNodes: [], nodesRef: { current: [] }, positions: { node: { x: 100, y: 100 } },
    positionsRef: { current: {} }, nodeElementsRef: { current: {} }, nodeHeightsRef: { current: {} },
    resizeObserverRef: { current: null }, resizeObserverRafRef: { current: null },
    setLayoutEpoch: jest.fn(), setPositions, getLayoutPositions: jest.fn(),
  }
  function Canvas({ layout }: { layout: typeof options.getLayoutPositions }) {
    const { registerNodeRef } = useImprentaMeasurement({ ...options, getLayoutPositions: layout })
    return <div data-node-id="node" ref={element => registerNodeRef("node", element)} />
  }
  const first = jest.fn()
  const latest = jest.fn((_nodes, positions) => positions)
  try {
    const view = render(<Canvas layout={first} />)
    const element = view.container.firstElementChild!
    expect(observe).toHaveBeenCalledWith(element)
    expect(options.nodesRef.current).toEqual(nodes)
    expect(options.positionsRef.current).toBe(options.positions)
    view.rerender(<Canvas layout={latest} />)
    act(() => {
      onResize([{ target: element, contentRect: { height: 320 } } as unknown as ResizeObserverEntry], options.resizeObserverRef.current!)
      frame(0)
    })
    setPositions.mock.calls[0][0](options.positions)
    expect(first).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith(nodes, options.positions, { node: 320 })
    expect(options.setLayoutEpoch).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  } finally {
    global.ResizeObserver = originalObserver
    raf.mockRestore()
    cancel.mockRestore()
  }
})