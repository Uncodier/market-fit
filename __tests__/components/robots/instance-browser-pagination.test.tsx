import { act, renderHook } from '@testing-library/react'
import { useInstanceBrowserPagination } from '@/app/components/robots/use-instance-browser-pagination'

it('retains the page on equivalent list arrays and resets when membership/order changes', () => {
  const ids = Array.from({ length: 80 }, (_, index) => `id-${index}`)
  const view = renderHook(({ rows, size }) => useInstanceBrowserPagination(rows, size), {
    initialProps: { rows: ids, size: 25 },
  })
  act(() => view.result.current.setCurrentPage(3))
  view.rerender({ rows: [...ids], size: 25 })
  expect(view.result.current.currentPage).toBe(3)
  view.rerender({ rows: ids.slice(0, 20), size: 25 })
  expect(view.result.current.currentPage).toBe(1)
  view.rerender({ rows: ids, size: 25 })
  expect(view.result.current.currentPage).toBe(1)
  act(() => view.result.current.setCurrentPage(2))
  view.rerender({ rows: [...ids].reverse(), size: 25 })
  expect(view.result.current.currentPage).toBe(1)
})
it('clamps page-size changes and invalid navigation without an effect', () => {
  const rows = Array.from({ length: 80 }, (_, index) => `id-${index}`)
  const view = renderHook(({ size }) => useInstanceBrowserPagination(rows, size), { initialProps: { size: 25 } })
  act(() => view.result.current.setCurrentPage(99))
  expect(view.result.current.currentPage).toBe(4)
  view.rerender({ size: 100 })
  expect(view.result.current.currentPage).toBe(1)
  act(() => view.result.current.setCurrentPage(-1))
  expect(view.result.current.currentPage).toBe(1)
})