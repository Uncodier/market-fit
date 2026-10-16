import {
  pendingGridLayout,
  pendingGridStyles,
  pendingRowWindow,
} from "@/app/shop/[siteSlug]/shop-pending-grid-layout"

describe("pendingGridLayout", () => {
  it.each([
    [0, 0, 1, 0, 0],
    [3, 7, 1, 0, 7],
    [0, 5, 2, 0, 3],
    [1, 6, 2, 1, 3],
    [4, 7, 3, 2, 2],
    [5, 1, 3, 1, 0],
    [8, 9, 4, 0, 3],
    [1, 8, 4, 3, 2],
    [2, 1, 4, 1, 0],
    [3, 0, 4, 0, 0],
    [1, 5001, 1, 0, 5001],
    [1, 5001, 2, 1, 2500],
    [1, 5001, 3, 2, 1667],
    [1, 5001, 4, 3, 1250],
  ])("packs loaded=%i pending=%i columns=%i into partial=%i rows=%i", (
    loaded, pending, columns, partialCount, rows,
  ) => {
    expect(pendingGridLayout(loaded, pending, columns)).toEqual({ partialCount, rows })
  })

  it.each([1, 2, 3, 4])("matches item-by-item packing for the %i-column breakpoint", (columns) => {
    for (let loaded = 0; loaded <= 8; loaded++) {
      for (let pending = 0; pending <= 9; pending++) {
        const occupiedRow = loaded > 0 ? Math.floor((loaded - 1) / columns) : -1
        let partialCount = 0
        const newRows = new Set<number>()
        for (let index = loaded; index < loaded + pending; index++) {
          const row = Math.floor(index / columns)
          if (row === occupiedRow) partialCount++
          else newRows.add(row)
        }
        expect(pendingGridLayout(loaded, pending, columns)).toEqual({
          partialCount, rows: newRows.size,
        })
      }
    }
  })
})

describe("pendingGridStyles", () => {
  it("reserves constant-size styles for a huge, nondivisible count at every breakpoint", () => {
    const { rows, partial } = pendingGridStyles(1, 5001)
    expect(rows).toEqual({
      "--shop-rows-1": 5001, "--shop-display-1": "block",
      "--shop-rows-2": 2500, "--shop-display-2": "block",
      "--shop-rows-3": 1667, "--shop-display-3": "block",
      "--shop-rows-4": 1250, "--shop-display-4": "block",
    })
    expect(partial).toEqual([
      { "--shop-display-1": "none", "--shop-display-2": "block", "--shop-display-3": "block", "--shop-display-4": "block" },
      { "--shop-display-1": "none", "--shop-display-2": "none", "--shop-display-3": "block", "--shop-display-4": "block" },
      { "--shop-display-1": "none", "--shop-display-2": "none", "--shop-display-3": "none", "--shop-display-4": "block" },
    ])
  })

  it.each([0, 1, 2, 3, 17, 5000])("never reserves more than three partial nodes for pending=%i", (pending) => {
    const { rows, partial } = pendingGridStyles(3, pending)
    expect(partial).toHaveLength(Math.min(1, pending))
    expect(Object.keys(rows)).toHaveLength(8)
    for (const columns of [1, 2, 3, 4]) {
      const expected = pendingGridLayout(3, pending, columns)
      expect(rows[`--shop-rows-${columns}`]).toBe(expected.rows)
      expect(rows[`--shop-display-${columns}`]).toBe(expected.rows ? "block" : "none")
      expect(partial.filter((style) => style[`--shop-display-${columns}`] === "block"))
        .toHaveLength(expected.partialCount)
    }
  })

  it.each([0, 12, 12000])("reserves no partial nodes when loaded=%i fills every breakpoint row", (loaded) => {
    expect(pendingGridStyles(loaded, 5000).partial).toHaveLength(0)
  })

  it.each([[1, 3], [2, 2], [3, 1], [4, 2], [5, 3], [6, 2], [7, 2]])(
    "reserves only the maximum breakpoint remainder for loaded=%i (%i slots)", (loaded, count) => {
      expect(pendingGridStyles(loaded, 5000).partial).toHaveLength(count)
    },
  )

  it("hides the row spacer when all pending items fit into the loaded row", () => {
    const { rows, partial } = pendingGridStyles(1, 2)
    expect(rows["--shop-display-1"]).toBe("block")
    expect(rows["--shop-display-2"]).toBe("block")
    expect(rows["--shop-display-3"]).toBe("none")
    expect(rows["--shop-display-4"]).toBe("none")
    expect(partial).toHaveLength(2)
  })
})

describe("pendingRowWindow", () => {
  const geometry = { top: 0, height: 32376, rows: 100, gap: 24, viewportHeight: 600 }

  it.each([
    { rows: 0 },
    { height: 0 },
    { height: -1 },
    { top: 1001 },
    { top: -32777 },
  ])("does not mount rows for empty or distant geometry: %j", (override) => {
    expect(pendingRowWindow({ ...geometry, ...override })).toEqual({ start: 0, end: 0, stride: 0 })
  })

  it.each([
    [0, 0, 4],
    [900, 0, 1],
    [1000, 0, 0],
    [-3240, 8, 14],
    [-31776, 96, 100],
    [-32400, 98, 100],
    [-32776, 99, 100],
  ])("uses default overscan at top=%i (rows %i to %i exclusive)", (top, start, end) => {
    expect(pendingRowWindow({ ...geometry, top })).toEqual({ start, end, stride: 324 })
  })

  it("can omit overscan without introducing a phantom gap after the last row", () => {
    expect(pendingRowWindow({ ...geometry, overscan: 0 })).toEqual({ start: 0, end: 2, stride: 324 })
    expect(pendingRowWindow({ ...geometry, top: -3240, overscan: 0 }))
      .toEqual({ start: 10, end: 12, stride: 324 })
    expect(pendingRowWindow({ top: 0, height: 900, rows: 3, gap: 0, viewportHeight: 600, overscan: 0 }))
      .toEqual({ start: 0, end: 2, stride: 300 })
  })

  it("clamps a short region to its actual rows", () => {
    expect(pendingRowWindow({ ...geometry, height: 624, rows: 2 }))
      .toEqual({ start: 0, end: 2, stride: 324 })
  })

  it.each([
    ["regular mobile", 1, 24],
    ["compact mobile", 2, 24],
    ["regular sm", 2, 24],
    ["regular md", 2, 32],
    ["compact md", 2, 24],
    ["regular lg", 3, 32],
    ["compact lg", 3, 32],
    ["regular xl", 4, 32],
    ["compact xl", 4, 32],
  ])("bounds a nondivisible 5001-item window at %s", (_breakpoint, columns, gap) => {
    const { rows } = pendingGridLayout(1, 5001, columns)
    const stride = 300 + gap
    const height = rows * stride - gap
    for (const row of [0, 1, Math.floor(rows / 2), rows - 1]) {
      const window = pendingRowWindow({ top: -row * stride, height, rows, gap, viewportHeight: 600 })
      expect(window.stride).toBe(stride)
      expect(window.start).toBeGreaterThanOrEqual(0)
      expect(window.end).toBeLessThanOrEqual(rows)
      expect(window.start).toBeLessThanOrEqual(row)
      expect(window.end).toBeGreaterThan(row)
      expect(window.end - window.start).toBeLessThanOrEqual(Math.ceil(1400 / stride) + 1)
    }
  })
})