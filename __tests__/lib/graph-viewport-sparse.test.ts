import { buildNodeCellGrid, collectIdsFromGrid } from '@/app/lib/graph-viewport'

it('bounds overview work by occupied cells instead of millions of empty cells', () => {
  const grid = buildNodeCellGrid(['a', 'b'], { a: { x: 0, y: 0 }, b: { x: 20000, y: 10000 } }, {}, 480, 300)
  const get = jest.spyOn(grid, 'get')
  expect(collectIdsFromGrid(grid, { minX: -100000, minY: -100000, maxX: 100000, maxY: 100000 })).toEqual(new Set(['a', 'b']))
  expect(get).not.toHaveBeenCalled()
  expect(collectIdsFromGrid(grid, { minX: 19500, minY: 9500, maxX: 21000, maxY: 11000 })).toEqual(new Set(['b']))
})