import { render, screen } from '@testing-library/react'
import {
  EmptyStateWelcome,
  getGreetingForHour,
} from '@/app/components/simple-messages-view/components/EmptyStateWelcome'

describe('EmptyStateWelcome', () => {
  it.each([
    [0, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('returns the greeting for hour %i', (hour, expectedGreeting) => {
    expect(getGreetingForHour(hour)).toBe(expectedGreeting)
  })

  it('shows the user first name and supporting prompt', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 21, 20))

    render(<EmptyStateWelcome userName="Sergio Prado" />)

    expect(screen.getByRole('heading', { name: 'Good evening, Sergio' })).toBeInTheDocument()
    expect(screen.getByText('Start with a goal, question, or task.')).toBeInTheDocument()

    jest.useRealTimers()
  })
})
