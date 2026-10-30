import { render } from '@testing-library/react'
import { ExitDemoMode } from '@/app/components/commerce/ExitDemoMode'
import { usePathname } from 'next/navigation'
import { exitDemoMode, isDemoModeActive } from '@/lib/demo-utils'

jest.mock('next/navigation', () => ({ usePathname: jest.fn() }))
jest.mock('@/lib/demo-utils', () => ({ exitDemoMode: jest.fn(), isDemoModeActive: jest.fn(() => true) }))

beforeEach(() => { jest.clearAllMocks(); jest.mocked(isDemoModeActive).mockReturnValue(true) })

it.each(['/tenders', '/tenders/demo-procurement/demo-tender-workplace', '/home/submissions', '/home/profile'])('retains the demo cookie after client hydration at %s', pathname => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  render(<ExitDemoMode />)
  expect(exitDemoMode).not.toHaveBeenCalled()
})

it('clears demo flags when navigating from a tender preview to checkout', () => {
  jest.mocked(usePathname).mockReturnValue('/tenders')
  const view = render(<ExitDemoMode />)
  jest.mocked(usePathname).mockReturnValue('/cart/checkout')
  view.rerender(<ExitDemoMode />)
  expect(exitDemoMode).toHaveBeenCalledTimes(1)
})