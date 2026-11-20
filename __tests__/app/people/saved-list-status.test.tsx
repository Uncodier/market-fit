import { render, screen } from '@testing-library/react'
import { SavedListStatus } from '@/app/people/saved-list-status'

it.each(['running', 'mining', 'in_progress'])('shows persisted membership progress for %s', status => {
  render(<SavedListStatus snapshot={{ status, completed: 3, total: 12 }} t={() => ''} />)
  expect(screen.getByRole('status')).toHaveTextContent('In Progress')
  const progress = screen.getByRole('progressbar', { name: 'Processing' })
  expect(progress).toHaveAttribute('aria-valuenow', '25')
  expect(progress).toHaveAttribute('aria-valuetext', '3 / 12')
})

it.each([['pending', 'Pending'], ['failed', 'Failed'], ['unexpected', 'Unknown']])('handles an empty %s list', (status, label) => {
  render(<SavedListStatus snapshot={{ status, completed: 0, total: 0 }} t={() => ''} />)
  expect(screen.getByRole('status')).toHaveTextContent(label)
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
})