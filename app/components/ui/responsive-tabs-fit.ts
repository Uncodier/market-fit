interface TabsFitOptions {
  widths: number[]
  availableWidth: number
  chromeWidth: number
  gap: number
  activeIndex: number
  overflowWidths: number[]
}

export function getVisibleTabIndices({
  widths, availableWidth, chromeWidth, gap, activeIndex, overflowWidths,
}: TabsFitOptions): number[] {
  const all = widths.map((_, index) => index)
  const requiredWidth = (indices: number[]) =>
    chromeWidth + indices.reduce((total, index) => total + widths[index], 0) +
    Math.max(0, indices.length - 1) * gap

  if (requiredWidth(all) <= availableWidth) return all

  for (let count = widths.length - 1; count >= 0; count--) {
    const indices = all.slice(0, count)
    if (count > 0 && activeIndex >= count && activeIndex < widths.length) {
      indices[count - 1] = activeIndex
    }
    const hiddenCount = widths.length - count
    const needed = requiredWidth(indices) + overflowWidths[hiddenCount] +
      (count > 0 ? gap : 0)
    if (needed <= availableWidth || count === 0) return indices
  }
  return []
}