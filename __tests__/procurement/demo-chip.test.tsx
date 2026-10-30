import { render, screen } from '@testing-library/react'
import DemoBanner from '@/app/components/DemoBanner'

beforeEach(() => {
  localStorage.clear()
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/'
})

afterEach(() => {
  localStorage.clear()
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/'
})

it('keeps the right-hand demo chip for an explicitly selected demo workspace', () => {
  document.cookie = 'market_fit_demo_site_id=demo-saas-en-123; path=/'
  localStorage.setItem('market_fit_manual_demo', 'true')
  render(<DemoBanner />)
  const chip = screen.getByRole('link', { name: 'Demo' })
  expect(chip).toHaveAttribute('href', '/demo')
  expect(chip.parentElement).toHaveClass('fixed', 'right-4')
})

it('does not add demo identification to the normal workspace', () => {
  const { container } = render(<DemoBanner />)
  expect(container).toBeEmptyDOMElement()
})