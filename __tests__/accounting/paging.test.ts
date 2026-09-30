import { readAllAccountingRows } from '@/app/accounting/paging'

describe('complete accounting reads', () => {
  it('reads every row even when the server caps pages below the requested size', async () => {
    const all = Array.from({ length: 1201 }, (_, id) => ({ id }))
    const query = jest.fn(() => ({ range: (from: number) => Promise.resolve({ data: all.slice(from, from + 100), count: all.length, error: null }) }))
    expect(await readAllAccountingRows(query)).toEqual(all)
    expect(query).toHaveBeenCalledTimes(13)
  })
  it('does not return partial data on a later page error', async () => {
    const query = jest.fn().mockReturnValueOnce({ range: () => ({ data: [{ id: 1 }], count: 2 }) })
      .mockReturnValueOnce({ range: () => ({ data: null, count: null, error: { message: 'unavailable' } }) })
    await expect(readAllAccountingRows(query)).rejects.toThrow('Unable to load complete')
  })
  it('rejects changed counts and missing page data', async () => {
    const query = jest.fn().mockReturnValueOnce({ range: () => ({ data: [1], count: 2 }) })
      .mockReturnValueOnce({ range: () => ({ data: [2], count: 3 }) })
    await expect(readAllAccountingRows(query)).rejects.toThrow('changed')
    await expect(readAllAccountingRows(() => ({ range: () => ({ data: [], count: 1 }) }))).rejects.toThrow('Incomplete')
  })
})