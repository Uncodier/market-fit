import { render, screen } from '@testing-library/react'
import { DialogBody } from '@/app/components/ui/dialog'
import { DocumentDialog } from '@/app/purchases/procurement/commerce/document-ui'
import { TimingEditor } from '@/app/purchases/procurement/components/timing-editor'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

test('procurement document dialogs give unstyled copy the same size as shared labels', () => {
  render(<DocumentDialog open onClose={jest.fn()} title="Procurement document" description="Document details">
    <DialogBody><p>Document context</p></DialogBody>
  </DocumentDialog>)
  expect(screen.getByRole('dialog')).toHaveClass('text-sm')
  expect(screen.getByRole('heading', { name: 'Procurement document' })).toHaveClass('text-base')
  expect(screen.getByText('Document details')).toHaveClass('text-sm')
})

test('settings deadline help uses readable body typography rather than metadata typography', () => {
  const { container } = render(<TimingEditor label="Response deadline" value={null} onChange={jest.fn()} timeZone="UTC" />)
  expect(container.querySelector('legend')).toHaveClass('text-sm', 'font-medium')
  expect(container.querySelector('p')).toHaveClass('text-sm', 'text-muted-foreground')
  expect(container.querySelector('p')).not.toHaveClass('text-xs')
})