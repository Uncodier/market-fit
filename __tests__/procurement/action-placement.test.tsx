import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TopBarPrimaryActions, TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { ProcurementToolbar } from '@/app/purchases/procurement/ui/workspace'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))

function PageAction({ label = 'Create tender' }: { label?: string }) {
  const [count, setCount] = useState(0)
  return <main><TopBarPrimaryActions><button disabled={count > 0} onClick={() => setCount(count + 1)}>{label}</button></TopBarPrimaryActions><output>{count}</output></main>
}
test('page primary renders only inside global TopBar and keeps its handler/state', () => {
  const shell = render(<header aria-label="Global TopBar"><TopBarPrimaryActionsSlot /></header>)
  const page = render(<PageAction />)
  const primary = within(screen.getByRole('banner')).getByRole('button', { name: 'Create tender' })
  expect(page.container.querySelector('button')).toBeNull()
  fireEvent.click(primary)
  expect(primary).toBeDisabled()
  expect(page.container).toHaveTextContent('1')
  page.unmount()
  expect(shell.container.querySelector('button')).toBeNull()
})
test('does not render a misplaced fallback if global shell is absent', () => {
  const page = render(<PageAction />)
  expect(page.container.querySelector('button')).toBeNull()
})
test('secondary toolbar controls precede the rightmost view selector outside filters', () => {
  const view = render(<ProcurementToolbar search="" onSearch={() => {}} actions={<button>Public directory</button>}
    viewSelector={<button>Table view</button>} />)
  const right = view.container.querySelector('[data-toolbar-actions]')!
  expect(right.lastElementChild).toHaveAttribute('data-view-selector')
  expect(within(right as HTMLElement).getAllByRole('button').map(button => button.textContent)).toEqual(['Public directory', 'Table view'])
  expect(right).toHaveClass('ml-auto')
})