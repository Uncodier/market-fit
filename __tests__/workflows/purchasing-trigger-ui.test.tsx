import { fireEvent, render, screen } from '@testing-library/react'
import { WorkflowTriggerTableEvents } from '@/app/components/workflows/workflow-trigger-body'
import { WORKFLOW_TABLE_OPTIONS } from '@/app/components/workflows/workflow-table-options'
import { DB_EVENT_TABLES, type WorkflowTriggerConfig } from '@/app/components/workflows/types'

jest.mock('@/app/components/workflows/workflow-cron-fields', () => ({ WorkflowCronFields: () => null }))
jest.mock('@/app/components/workflows/workflow-channel-message-fields', () => ({ WorkflowChannelMessageFields: () => null }))

describe('Purchasing trigger UI', () => {
  const onPersist = jest.fn().mockResolvedValue(undefined)
  beforeEach(() => onPersist.mockClear())

  it('provides labels, descriptions and searchable table IDs for every supported table', () => {
    expect(WORKFLOW_TABLE_OPTIONS.map(option => option.value)).toEqual([...DB_EVENT_TABLES])
    for (const option of WORKFLOW_TABLE_OPTIONS) {
      expect(option.label).toBeTruthy()
      expect(option.description).toBeTruthy()
      expect(option.searchText).toContain(option.value)
    }
    expect(WORKFLOW_TABLE_OPTIONS.filter(option => option.group === 'Purchasing')).toHaveLength(13)
  })

  it('adds a purchase request event without replacing existing events or filters', () => {
    const trigger: WorkflowTriggerConfig = {
      kind: 'db_event', filter: { status: 'approved' },
      db_events: [{ table: 'deals', op: ['update'] }],
    }
    render(<WorkflowTriggerTableEvents trigger={trigger} onPersist={onPersist} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Purchasing Event' }))
    expect(onPersist).toHaveBeenCalledWith({ trigger: {
      ...trigger, db_events: [...trigger.db_events!, { table: 'procurement_requests', op: ['insert'] }],
    } })
  })

  it('shows grouped purchasing choices and persists canonical table IDs', () => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', db_events: [
      { table: 'procurement_requests', op: ['insert'] },
    ] }} onPersist={onPersist} />)
    const input = screen.getByLabelText('Table for event 1')
    expect(input).toHaveValue('Purchase requests')
    expect(screen.getByRole('status')).toHaveTextContent('approval policies')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'purchase_orders' } })
    fireEvent.click(screen.getByText('Purchase orders'))
    expect(onPersist).toHaveBeenCalledWith({ trigger: {
      kind: 'db_event', db_events: [{ table: 'purchase_orders', op: ['insert'] }],
    } })
  })

  it('does not offer arbitrary unsupported tables', () => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', table: 'procurement_requests', op: 'update' }} onPersist={onPersist} />)
    const input = screen.getByLabelText('Table for event 1')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'procurement_credentials' } })
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.queryByText('Use "procurement_credentials"')).not.toBeInTheDocument()
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('updates operations and removes a legacy single-table event', () => {
    const trigger: WorkflowTriggerConfig = { kind: 'db_event', table: 'procurement_tenders', op: 'insert' }
    render(<WorkflowTriggerTableEvents trigger={trigger} onPersist={onPersist} />)
    expect(screen.getByRole('button', { name: 'insert' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'update' }))
    expect(onPersist).toHaveBeenLastCalledWith({ trigger: {
      ...trigger, db_events: [{ table: 'procurement_tenders', op: ['insert', 'update'] }],
    } })
    fireEvent.click(screen.getByRole('button', { name: 'Remove table event 1' }))
    expect(onPersist).toHaveBeenLastCalledWith({ trigger: { ...trigger, db_events: [] } })
  })

  it.each(['procurement_tender_publications', 'procurement_awards', 'purchase_orders',
    'procurement_receipts', 'catalog_item_suppliers'])('disables impossible operations for %s', table => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', db_events: [{ table, op: ['insert'] }] }} onPersist={onPersist} />)
    expect(screen.getByRole('button', { name: 'insert' })).toBeEnabled()
    for (const op of ['update', 'delete']) {
      const button = screen.getByRole('button', { name: op })
      expect(button).toBeDisabled()
      fireEvent.click(button)
    }
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('allows supplier updates but not deletes', () => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', table: 'suppliers', op: 'insert' }} onPersist={onPersist} />)
    expect(screen.getByRole('button', { name: 'delete' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'update' }))
    expect(onPersist).toHaveBeenCalledWith({ trigger: {
      kind: 'db_event', table: 'suppliers', op: 'insert', db_events: [{ table: 'suppliers', op: ['insert', 'update'] }],
    } })
  })

  it.each([false, true])('preserves legacy unsupported selections on load (single table: %s) and explicitly repairs them', single => {
    const trigger: WorkflowTriggerConfig = single
      ? { kind: 'db_event', table: 'purchase_orders', op: 'update', filter: { status: 'approved' } }
      : { kind: 'db_event', db_events: [{ table: 'purchase_orders', op: ['update', 'delete'] }], filter: { status: 'approved' } }
    render(<WorkflowTriggerTableEvents trigger={trigger} onPersist={onPersist} />)
    expect(screen.getByRole('button', { name: 'update' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('These events cannot fire')
    expect(onPersist).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Repair operations' }))
    expect(onPersist).toHaveBeenCalledWith({ trigger: {
      ...trigger, db_events: [{ table: 'purchase_orders', op: ['insert'] }],
    } })
  })

  it.each([['update'], ['insert', 'update', 'delete']])('normalizes %j when switching to an immutable table, preserving other events', (...ops) => {
    const trigger: WorkflowTriggerConfig = { kind: 'db_event', filter: { status: 'approved' }, db_events: [
      { table: 'deals', op: ops as ('insert' | 'update' | 'delete')[] },
      { table: 'tasks', op: ['delete'] },
    ] }
    render(<WorkflowTriggerTableEvents trigger={trigger} onPersist={onPersist} />)
    const input = screen.getByLabelText('Table for event 1')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'purchase_orders' } })
    fireEvent.click(screen.getByText('Purchase orders'))
    expect(onPersist).toHaveBeenCalledWith({ trigger: { ...trigger, db_events: [
      { table: 'purchase_orders', op: ['insert'] }, { table: 'tasks', op: ['delete'] },
    ] } })
  })

  it('does not enable extra operations when switching back to a mutable table', () => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', db_events: [
      { table: 'purchase_orders', op: ['insert'] },
    ] }} onPersist={onPersist} />)
    const input = screen.getByLabelText('Table for event 1')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'deals' } })
    fireEvent.click(screen.getByText('Deals'))
    expect(onPersist).toHaveBeenCalledWith({ trigger: { kind: 'db_event', db_events: [{ table: 'deals', op: ['insert'] }] } })
  })

  it('keeps unknown saved tables visible without offering new operations', () => {
    render(<WorkflowTriggerTableEvents trigger={{ kind: 'db_event', table: 'retired_table', op: 'delete' }} onPersist={onPersist} />)
    expect(screen.getByLabelText('Table for event 1')).toHaveValue('retired_table')
    expect(screen.getByRole('alert')).toHaveTextContent('retired_table')
    for (const op of ['insert', 'update', 'delete']) expect(screen.getByRole('button', { name: op })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Repair operations' })).not.toBeInTheDocument()
    expect(onPersist).not.toHaveBeenCalled()
  })
})