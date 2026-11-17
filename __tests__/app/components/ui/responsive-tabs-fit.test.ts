import { getVisibleTabIndices } from "@/app/components/ui/responsive-tabs-fit"

const fit = (widths: number[], availableWidth: number, activeIndex = 0,
  gap = 0, chromeWidth = 0, overflowWidths = widths.map(() => 40).concat(40)) =>
  getVisibleTabIndices({ widths, availableWidth, activeIndex, gap, chromeWidth, overflowWidths })

describe("responsive tab fitting", () => {
  it("shows every tab at the exact boundary without reserving overflow space", () => {
    expect(fit([100, 100, 100], 312, 0, 4, 4)).toEqual([0, 1, 2])
    expect(fit([100, 100, 100], 311, 0, 4, 4)).toEqual([0, 1])
  })

  it("measures the active replacement instead of the removed tab", () => {
    expect(fit([50, 50, 180], 200, 2)).toEqual([])
    expect(fit([50, 50, 180], 220, 2)).toEqual([2])
    expect(fit([50, 50, 180], 270, 2)).toEqual([0, 2])
  })

  it("uses an overflow-only selector when the active tab cannot fit", () => {
    expect(fit([50, 50, 180], 100, 2)).toEqual([])
    expect(fit([100], 60)).toEqual([])
    expect(fit([100], 10)).toEqual([])
  })

  it("accounts for the actual hidden count width and responsive gap", () => {
    expect(fit([50, 50, 50, 50], 160, 0, 8, 4, [0, 40, 40, 60, 60])).toEqual([0, 1])
    expect(fit([50, 50, 50, 50], 159, 0, 8, 4, [0, 40, 40, 60, 60])).toEqual([0])
  })

  it("handles empty lists and an absent active tab", () => {
    expect(fit([], 100)).toEqual([])
    expect(fit([50, 50, 50], 140, -1)).toEqual([0, 1])
  })
})