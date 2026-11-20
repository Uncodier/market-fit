import { fireEvent, render, screen } from '@testing-library/react'
import { PeopleResultsView } from '@/app/people/people-results-view'
import type { PeopleWorkspace } from '@/app/people/use-people-workspace'
import { savedSnapshot } from './saved-list-fixtures'

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
  SidebarToggle: ({ onToggle, isCollapsed }: { onToggle: () => void; isCollapsed: boolean }) =>
    <button onClick={onToggle}>{isCollapsed ? 'Show filters' : 'Hide filters'}</button>,
}))
jest.mock('@/app/people/people-results-table', () => ({
  PeopleResultsTable: () => <div>People table</div>,
}))
jest.mock('@/app/people/use-saved-list-members', () => ({ useSavedListMembers: jest.fn(() => ({
  snapshot: { ...savedSnapshot(), name: 'Pregenerated list' }, page: 1, loading: false, error: null,
  identityChanged: false, refresh: jest.fn(), onPageChange: jest.fn(),
})) }))

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
    setPeopleTab: jest.fn(),
    currentPage: 1,
    itemsPerPage: 10,
    pageJump: '',
    setPageJump: jest.fn(),
    searchResults: Array.from({ length: 10 }, () => ({})),
    totalResults: 25,
    loading: false,
    selectedPersonIds: [],
    isEnriching: false,
    openEnrichConfirmation: jest.fn(),
    selectionLists: { open: jest.fn(), pending: false },
    onPageChange: jest.fn(),
    isEmptyView: false,
    currentSite: { id: 'site-a' },
    selectedList: null,
    setSelectedList: jest.fn(),
    setSelectedPersonIds: jest.fn(),
    resetResultSelection: jest.fn(),
    setExpandedGroups: jest.fn(),
    ...overrides,
  } as unknown as PeopleWorkspace
}

it.each(['search', 'saved'] as const)('shows the count and working pagination in the %s tab', peopleTab => {
  const state = workspace({ peopleTab })
  render(<PeopleResultsView workspace={state} />)

  expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 to 10 of 25 people')
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  expect(state.onPageChange).toHaveBeenCalledWith(2)
  fireEvent.click(screen.getByRole('button', { name: /^3$/ }))
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

it.each([
  { isLayoutCollapsed: false, isSidebarCollapsed: false, isArtifact: false, left: '575px' },
  { isLayoutCollapsed: true, isSidebarCollapsed: false, isArtifact: false, left: '383px' },
  { isLayoutCollapsed: false, isSidebarCollapsed: true, isArtifact: false, left: '256px' },
  { isLayoutCollapsed: true, isSidebarCollapsed: true, isArtifact: false, left: '64px' },
  { isLayoutCollapsed: false, isSidebarCollapsed: false, isArtifact: true, left: '319px' },
  { isLayoutCollapsed: false, isSidebarCollapsed: true, isArtifact: true, left: '0px' },
])('shares the result frame for pregenerated lists with desktop left offset $left', ({ left, ...layout }) => {
  const state = workspace(layout)
  const { rerender } = render(<PeopleResultsView workspace={state} />)
  const frame = screen.getByTestId('people-results')
  expect(frame.style.getPropertyValue('--people-results-left')).toBe(left)
  expect(frame).toHaveClass('fixed', 'right-0', 'left-0', 'md:left-[var(--people-results-left)]')

  rerender(<PeopleResultsView workspace={{ ...state, selectedList: { id: 'list-a', siteId: 'site-a' } }} />)
  expect(screen.getByTestId('people-results')).toBe(frame)
  expect(Boolean(screen.queryByRole('heading', { name: 'Pregenerated list' }))).toBe(layout.isArtifact)
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  expect(frame.style.getPropertyValue('--people-results-left')).toBe(left)
  expect(frame).toContainElement(screen.getByText('People table'))
})

it('preserves the mobile two-step view and restores the sidebar when closing a pregenerated list', () => {
  const state = workspace({ selectedList: { id: 'list-a', siteId: 'site-a' }, showResultsOnMobile: false })
  const { rerender } = render(<PeopleResultsView workspace={state} />)
  expect(screen.getByTestId('people-results')).toHaveClass('hidden', 'md:flex')
  rerender(<PeopleResultsView workspace={{ ...state, showResultsOnMobile: true }} />)
  expect(screen.getByTestId('people-results')).not.toHaveClass('hidden')
  expect(screen.queryByRole('button', { name: /^Back/ })).not.toBeInTheDocument()
  fireEvent(window, new Event('people:return-to-search'))
  expect(state.setPeopleTab).toHaveBeenCalledWith('search')
  expect(state.setIsSidebarCollapsed).toHaveBeenCalledWith(false)
  expect(state.setSelectedList).toHaveBeenCalledWith(null)
  expect(state.resetResultSelection).toHaveBeenCalledTimes(1)
  expect(state.setShowResultsOnMobile).toHaveBeenCalledWith(false)
})

it('retains the sidebar toggle inside pregenerated-list results', () => {
  const state = workspace({ selectedList: { id: 'list-a', siteId: 'site-a' } })
  render(<PeopleResultsView workspace={state} />)
  fireEvent.click(screen.getByRole('button', { name: 'Hide filters' }))
  expect(state.setIsSidebarCollapsed).toHaveBeenCalledWith(true)
})

it('never opens a pregenerated list belonging to the previous site', () => {
  render(<PeopleResultsView workspace={workspace({ selectedList: { id: 'list-a', siteId: 'site-b' } })} />)
  expect(screen.queryByRole('heading', { name: 'Pregenerated list' })).not.toBeInTheDocument()
  expect(screen.getByText('People table')).toBeInTheDocument()
})

it('provides the same breadcrumb inside an artifact without a global top bar', () => {
  const state = workspace({ isArtifact: true, selectedList: { id: 'list-a', siteId: 'site-a' } })
  render(<PeopleResultsView workspace={state} />)
  fireEvent.click(screen.getByRole('button', { name: 'Search people' }))
  expect(state.setSelectedList).toHaveBeenCalledWith(null)
})
