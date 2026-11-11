import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { CatalogFilterTabs } from "@/app/catalog/components/CatalogFilterTabs"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))

function FilterHarness() {
  const [kind, setKind] = useState<'all' | 'product' | 'service' | 'variant'>('all')
  const [status, setStatus] = useState<'active' | 'archived'>('active')
  return <CatalogFilterTabs kind={kind} status={status} onChange={(nextKind, nextStatus) => {
    setKind(nextKind)
    setStatus(nextStatus)
  }} />
}

describe("Catalog filter segments", () => {
  it("renders one selector with Active selected by default", () => {
    render(<FilterHarness />)
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(screen.getAllByRole('tab')).toHaveLength(5)
    expect(screen.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true')
  })

  it.each(['Products', 'Services', 'Variants', 'Active'])("switches from Archived to %s", (name) => {
    render(<FilterHarness />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Archived' }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('tab', { name: 'Archived' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Archived' })).toHaveAttribute('aria-selected', 'false')
  })

  it.each([
    ['Active', 'all', 'active'],
    ['Products', 'product', 'active'],
    ['Services', 'service', 'active'],
    ['Variants', 'variant', 'active'],
    ['Archived', 'all', 'archived'],
  ])("maps %s to its catalog query filters", (name, kind, status) => {
    const onChange = jest.fn()
    render(<CatalogFilterTabs kind="product" status={name === 'Archived' ? 'active' : 'archived'} onChange={onChange} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false })
    expect(onChange).toHaveBeenCalledWith(kind, status)
  })
})