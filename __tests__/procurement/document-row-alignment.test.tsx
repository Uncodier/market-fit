import { render, screen, within } from '@testing-library/react'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { Button } from '@/app/components/ui/button'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: 'en' }),
}))

test('centers multiline labels, plain text and action buttons vertically in document rows', () => {
  render(<DocumentTable empty="No rows" rows={[{ id: 'draft' }]} columns={[
    { label: 'Tender', render: () => <><p>Equipment</p><p>Version 6</p></> },
    { label: 'Reference', render: () => 'Offer' },
    { label: 'Action', render: () => <Button>Resume</Button> },
  ]} />)
  const row = screen.getByText('Equipment').closest('tr')!
  for (const cell of within(row).getAllByRole('cell')) {
    expect(cell).toHaveClass('align-middle')
    expect(cell).not.toHaveClass('align-top')
  }
  expect(within(row).getByRole('button', { name: 'Resume' })).toBeInTheDocument()
})