import { fireEvent, render, screen, within } from '@testing-library/react'
import { PeopleResultsTable } from '@/app/people/people-results-table'
import { usePeopleResultGroups } from '@/app/people/use-people-result-groups'
import type { PeopleWorkspace } from '@/app/people/use-people-workspace'
import type { SavedListMember } from '@/app/people/saved-list-types'
import { savedMember } from './saved-list-fixtures'

const toggleSelection = jest.fn()
function Harness({ members, processing = true }: { members: SavedListMember[]; processing?: boolean }) {
  const groups = usePeopleResultGroups({ searchResults: members.map(m => m.result), setExpandedGroups: jest.fn() })
  const workspace = { ...groups, error: null, selectedPersonIds: [], addedPersonIds: new Set(), expandedGroups: {},
    togglePersonSelection: toggleSelection } as unknown as PeopleWorkspace
  return <PeopleResultsTable workspace={workspace} processingByPerson={processing ? new Map(members.map(m => [m.personId, m])) : undefined} />
}
beforeEach(() => jest.clearAllMocks())

it('uses the normal person columns alongside processing, outcome and linked lead', () => {
  render(<Harness members={[savedMember()]} />)
  const headers = screen.getAllByRole('columnheader').map(h => h.textContent)
  expect(headers.slice(1, 8)).toEqual(['Person Name', 'Role Title', 'Company', 'Person Location', 'Processing', 'Outcome', 'Lead'])
  expect(headers).toHaveLength(22)
  const row = screen.getByText('Alice').closest('tr')!
  expect(within(row).getByText('Director')).toBeInTheDocument()
  expect(within(row).getByText('Factory')).toBeInTheDocument()
  expect(within(row).getByText('Completed')).toBeInTheDocument()
  expect(within(row).getByText('Matched')).toBeInTheDocument()
  fireEvent.click(within(row).getByRole('link', { name: 'View lead' }))
  expect(toggleSelection).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Alice'))
  expect(toggleSelection).toHaveBeenCalledWith('42')
})

it('preserves pending, no-match and review states without assuming a lead exists', () => {
  render(<Harness members={[
    { ...savedMember('1', 'Pending person'), processing: 'pending', outcome: null, lead: null },
    { ...savedMember('2', 'No-match person'), outcome: 'no_match', lead: null },
    { ...savedMember('3', 'Review person'), outcome: 'needs_review', lead: null },
  ]} />)
  expect(screen.getByText('Pending')).toBeInTheDocument()
  expect(screen.getByText('No match')).toBeInTheDocument()
  expect(screen.getByText('Needs review')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

it('does not add processing columns to an ordinary provider search', () => {
  render(<Harness members={[savedMember()]} processing={false} />)
  expect(screen.getAllByRole('columnheader')).toHaveLength(19)
  expect(screen.queryByRole('columnheader', { name: 'Processing' })).not.toBeInTheDocument()
})