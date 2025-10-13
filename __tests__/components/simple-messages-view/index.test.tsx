import React from 'react'
import { render, screen } from '@testing-library/react'
import { SimpleMessagesView } from '@/app/components/simple-messages-view'

// Mock the required contexts and hooks
jest.mock('@/app/context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false })
}))

jest.mock('@/app/context/SiteContext', () => ({
  useSite: () => ({ currentSite: { id: 'test-site' } })
}))

jest.mock('@/app/context/RobotsContext', () => ({
  useRobots: () => ({ refreshRobots: jest.fn() })
}))

jest.mock('@/app/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() })
}))

jest.mock('@/app/hooks/useOptimizedMessageState', () => ({
  useOptimizedMessageState: () => ({
    message: '',
    setMessage: jest.fn(),
    messageRef: { current: '' },
    handleMessageChange: jest.fn(),
    clearMessage: jest.fn(),
    textareaRef: { current: null }
  })
}))

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: jest.fn(() => 'new') }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() })
}))

describe('SimpleMessagesView', () => {
  it('renders without crashing', () => {
    render(<SimpleMessagesView />)
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders with custom className', () => {
    render(<SimpleMessagesView className="custom-class" />)
    const container = screen.getByRole('main')
    expect(container).toHaveClass('custom-class')
  })

  it('renders message input when no active robot instance', () => {
    render(<SimpleMessagesView />)
    // The component should render the message input area
    expect(screen.getByPlaceholderText(/send prompt/i)).toBeInTheDocument()
  })
})
