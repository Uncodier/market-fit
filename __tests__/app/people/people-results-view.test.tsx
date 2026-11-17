import { fireEvent, render, screen } from '@testing-library/react'
import { PeopleResultsView } from '@/app/people/people-results-view'
import type { PeopleWorkspace } from '@/app/people/use-people-workspace'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => ({
    'commerce.pagination.previous': 'Previous',
    'commerce.pagination.next': 'Next',
  }[key] || '') }),
}))
jest.mock('@/app/components/ui/sticky-header', () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/app/control-center/components/SidebarToggle', () => ({
  SidebarToggle: () => null,
}))
jest.mock('@/app/people/people-results-table', () => ({
  PeopleResultsTable: () => <div>People table</div>,
}))

function workspace(overrides: Partial<PeopleWorkspace> = {}) {
  return {
    isArtifact: false,
    t: () => '',
    isLayoutCollapsed: false,
    isSidebarCollapsed: false,
    setIsSidebarCollapsed: jest.fn(),
    peopleTab: 'saved',
    showResultsOnMobile: true,
    setShowResultsOnMobile: jest.fn(),
    currentPage: 1,
    itemsPerPage: 10,
    pageJump: '',
    setPageJump: jest.fn(),
    searchResults: Array.from({ length: 10 }, () => ({})),
    totalResults: 25,
    loading: false,
    selectedPersonIds: [],
    isEnriching: false,
    setIsConfirmModalOpen: jest.fn(),
    selectionLists: { open: jest.fn(), pending: false },
    onPageChange: jest.fn(),
    isEmptyView: false,
    ...overrides,
  } as unknown as PeopleWorkspace
}

it.each(['search', 'saved'] as const)('shows the count and working pagination in the %s tab', peopleTab => {
  const state = workspace({ peopleTab })
  render(<PeopleResultsView workspace={state} />)

  expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 10 of 25 people')
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(state.onPageChange).toHaveBeenCalledWith(2)
  fireEvent.click(screen.getByRole('button', { name: '3', exact: true }))
  expect(state.onPageChange).toHaveBeenCalledWith(3)
})

it('shows the last saved-list page range and permits jumping to a page', () => {
  const state = workspace({ currentPage: 3, searchResults: [{}, {}, {}, {}, {}], pageJump: '2' })
  render(<PeopleResultsView workspace={state} />)

  expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 21 to 25 of 25 people')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Go to page' }), { key: 'Enter' })
  expect(state.onPageChange).toHaveBeenCalledWith(2)
  expect(state.setPageJump).toHaveBeenCalledWith('')
})

it('does not expose stale counts or page controls while a saved list is loading', () => {
  render(<PeopleResultsView workspace={workspace({ loading: true })} />)

  expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  expect(screen.queryByRole('spinbutton', { name: 'Go to page' })).not.toBeInTheDocument()
})