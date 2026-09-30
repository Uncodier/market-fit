/** The factory must request an exact count and a deterministic unique ordering. */
export async function readAllAccountingRows<T>(queryFactory: () => any): Promise<T[]> {
  const rows: T[] = []
  let expectedCount: number | undefined
  for (;;) {
    const { data, error, count } = await queryFactory().range(rows.length, rows.length + 499)
    if (error) throw new Error('Unable to load complete accounting data')
    if (!Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) {
      throw new Error('Accounting query did not return a complete result count')
    }
    if (expectedCount !== undefined && count !== expectedCount) {
      throw new Error('Accounting data changed while loading. Please retry.')
    }
    expectedCount = count
    rows.push(...data)
    if (rows.length === count) return rows
    if (rows.length > count || data.length === 0) throw new Error('Incomplete accounting data. Please retry.')
  }
}