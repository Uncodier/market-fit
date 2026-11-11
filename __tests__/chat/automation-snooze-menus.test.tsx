import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { LeadActionsMenu } from '@/app/leads/components/LeadActionsMenu'
import { LeadRowMenu } from '@/app/leads/components/lead-row-menu'
import type { Lead } from '@/app/leads/types'

jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => ({ can: () => true }) }))
jest.mock('@/app/leads/components/LeadPaymentDialog', () => ({ LeadPaymentDialog: () => null }))
jest.mock('@/app/leads/components/LeadAutomationSnoozeDialog', () => ({
  LeadAutomationSnoozeDialog: ({ open, leadId, leadName, onOpenChange }: {
    open: boolean; leadId: string; leadName: string; onOpenChange: (open: boolean) => void
  }) => open ? <div role="dialog" aria-label="Automation Snooze" data-lead-id={leadId}>
    {leadName}<button onClick={() => onOpenChange(false)}>Close snooze</button>
  </div> : null,
}))

function setup(kind: 'row' | 'detail', leadCount = 1) {
  const handlers = {
    onResearch: jest.fn(), onFollowUp: jest.fn(), onInvalidate: jest.fn(),
    onEdit: jest.fn(), onConversation: jest.fn(), onDelete: jest.fn(),
  }
  const rowClick = jest.fn()
  const lead = { id: 'lead-a', name: 'Example lead' } as Lead
  render(<div onClick={rowClick}>{kind === 'row'
    ? <LeadRowMenu lead={lead} leadCount={leadCount} loading={null} success={null} {...handlers} />
    : <LeadActionsMenu lead={lead} loading={null} {...handlers} />}</div>)
  fireEvent.keyDown(screen.getByRole('button', { name: kind === 'row' ? 'Open actions' : 'Open menu' }), { key: 'Enter', code: 'Enter' })
  return { rowClick, handlers }
}

it.each(['row', 'detail'] as const)('opens the individual %s lead snooze dialog from its actual menu', kind => {
  const { rowClick, handlers } = setup(kind)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getAllByRole('menuitem', { name: 'Automation Snooze' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Automation Snooze' }))
  expect(screen.getByRole('dialog')).toHaveAttribute('data-lead-id', 'lead-a')
  expect(screen.getByRole('dialog')).toHaveTextContent('Example lead')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  if (kind === 'row') expect(rowClick).not.toHaveBeenCalled()
  for (const callback of Object.values(handlers)) expect(callback).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Close snooze' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('does not expose Automation Snooze on aggregate bulk menus', () => {
  const { handlers } = setup('row', 3)
  expect(screen.queryByRole('menuitem', { name: 'Automation Snooze' })).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Follow-up all 3 leads' }))
  expect(handlers.onFollowUp).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})