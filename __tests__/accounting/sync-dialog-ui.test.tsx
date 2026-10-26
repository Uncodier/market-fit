import './ui-fixtures'
import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deferred } from './ui-fixtures'
import { SyncJournalEntriesDialog } from '@/app/accounting/components/SyncJournalEntriesDialog'
import { preparePeriodSync, syncPeriodBatch } from '@/app/accounting/ensure'
import { toast } from 'sonner'

jest.mock('@/app/accounting/ensure', () => ({ preparePeriodSync: jest.fn(), syncPeriodBatch: jest.fn() }))
jest.mock('@/app/components/ui/date-picker', () => ({ DatePicker: ({ disabled }: { disabled: boolean }) => <button type="button" disabled={disabled}>Date</button> }))

const sources = Array.from({ length: 26 }, (_, id) => ({ type: 'sale' as const, id: String(id) }))

beforeEach(() => {
  jest.mocked(preparePeriodSync).mockResolvedValue(sources)
  jest.mocked(syncPeriodBatch).mockResolvedValue({ processed: 1, failed: 0 })
})

it('shows preparation and batch progress, blocks duplicate submits, and completes after all batches', async () => {
  const prepare = deferred<typeof sources>()
  const first = deferred<{ processed: number; failed: number }>()
  const last = deferred<{ processed: number; failed: number }>()
  jest.mocked(preparePeriodSync).mockReturnValueOnce(prepare.promise)
  jest.mocked(syncPeriodBatch).mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  const onSynced = jest.fn()
  const onOpenChange = jest.fn()
  render(<SyncJournalEntriesDialog open onSynced={onSynced} onOpenChange={onOpenChange} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sync Data' }))
  expect(screen.getByRole('status')).toHaveTextContent('Finding documents')
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Syncing...' }).closest('form')!)
  expect(preparePeriodSync).toHaveBeenCalledTimes(1)
  await act(async () => prepare.resolve(sources))
  expect(screen.getByRole('status')).toHaveTextContent('0 / 26')
  expect(syncPeriodBatch).toHaveBeenCalledWith('site-a', sources.slice(0, 25))
  await act(async () => first.resolve({ processed: 25, failed: 0 }))
  expect(screen.getByRole('status')).toHaveTextContent('25 / 26')
  expect(onSynced).not.toHaveBeenCalled()
  await act(async () => last.resolve({ processed: 1, failed: 0 }))
  expect(onSynced).toHaveBeenCalledTimes(1)
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(toast.success).toHaveBeenCalledWith('Sync completed')
})

it('retains partial-failure details and never announces success', async () => {
  jest.mocked(syncPeriodBatch).mockResolvedValueOnce({ processed: 25, failed: 2 })
  const onSynced = jest.fn()
  render(<SyncJournalEntriesDialog open onSynced={onSynced} onOpenChange={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sync Data' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('2 of 26'))
  expect(syncPeriodBatch).toHaveBeenCalledTimes(2)
  expect(onSynced).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Sync Data' })).toBeEnabled()
})

it('stops submitting batches when a request fails', async () => {
  jest.mocked(syncPeriodBatch).mockRejectedValueOnce(new Error('Connection lost; some entries may have been saved'))
  render(<SyncJournalEntriesDialog open onSynced={jest.fn()} onOpenChange={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Sync Data' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection lost'))
  expect(syncPeriodBatch).toHaveBeenCalledTimes(1)
  expect(toast.success).not.toHaveBeenCalled()
})