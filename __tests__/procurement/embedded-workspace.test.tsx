import { render, screen } from '@testing-library/react'
import { ProcurementWorkspace } from '@/app/purchases/procurement/ui/workspace'

jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))

test('embedded settings keep the parent header, breadcrumb and scroll container', () => {
  const listener = jest.fn()
  window.addEventListener('breadcrumb:update', listener)
  const view = render(<ProcurementWorkspace embedded title="Tender settings" toolbar={<span>Section toolbar</span>}>
    <div>Settings fields</div>
  </ProcurementWorkspace>)
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByText('Section toolbar')).not.toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Tender settings' })).toHaveTextContent('Settings fields')
  expect(view.container.querySelector('.overflow-auto')).toBeNull()
  expect(listener).not.toHaveBeenCalled()
  window.removeEventListener('breadcrumb:update', listener)
})

test('standalone procurement screens retain their sticky toolbar', () => {
  render(<ProcurementWorkspace title="Tender settings" toolbar={<span>Section toolbar</span>}>
    <div>Settings fields</div>
  </ProcurementWorkspace>)
  expect(screen.getByRole('banner')).toHaveTextContent('Section toolbar')
  expect(screen.getByRole('heading', { name: 'Tender settings' })).toBeInTheDocument()
})

test('switching embedded mode and locale does not change hook dependencies or retain the revision bar', () => {
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
  const listener = jest.fn()
  window.addEventListener('breadcrumb:update', listener)
  const props = { title: 'Procurement settings', toolbar: <span>Revision 2</span>, children: <div>Fields</div> }
  const view = render(<ProcurementWorkspace {...props} />)
  expect(screen.getByRole('banner')).toHaveTextContent('Revision 2')
  listener.mockClear()
  view.rerender(<ProcurementWorkspace {...props} embedded title="Configuración de compras" />)
  expect(screen.queryByRole('banner')).not.toBeInTheDocument()
  expect(screen.queryByText('Revision 2')).not.toBeInTheDocument()
  expect(listener).not.toHaveBeenCalled()
  view.rerender(<ProcurementWorkspace {...props} />)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
  window.removeEventListener('breadcrumb:update', listener)
})