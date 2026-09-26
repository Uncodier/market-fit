import { fireEvent, render, screen } from '@testing-library/react'
import { ContextSelectorModal } from '@/app/components/ui/context-selector-modal'

jest.mock('@/app/hooks/use-context-entities-search', () => ({
  useContextEntitiesSearch: () => ({
    searchResults: {},
    loading: false,
    error: null,
    searchAll: jest.fn(),
    clearSearch: jest.fn(),
    loadInitialData: jest.fn(),
    enabledCollections: [],
    hasInitialized: false,
  }),
}))

describe('context selector trigger', () => {
  it('uses an at-sign icon, keeps its label and selected count', () => {
    render(
      <ContextSelectorModal
        selectedContext={{
          leads: ['lead-1'], contents: [], requirements: [], tasks: [],
          campaigns: [], quotations: [], deals: [], records: [],
        }}
        onContextChange={jest.fn()}
        hideChips
      />,
    )

    const trigger = screen.getByRole('button', { name: /context/i })
    expect(trigger).toHaveTextContent('context')
    expect(trigger).toHaveTextContent('1')
    expect(trigger).not.toHaveTextContent('@')
    expect(trigger.querySelector('svg')).toBeInTheDocument()

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Add context' })).toBeInTheDocument()
  })
})