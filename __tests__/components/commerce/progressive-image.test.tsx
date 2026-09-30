import { fireEvent, render, screen } from '@testing-library/react'
import { ProgressiveImage } from '@/app/components/commerce/ProgressiveImage'

it('normalizes persisted prompt URLs instead of issuing uncredentialed external requests', () => {
  render(<ProgressiveImage directUrl="https://old-api.test/api/public/image/prompt/Coffee?width=400&height=400" alt="Coffee" />)
  for (const image of screen.getAllByAltText('Coffee')) {
    expect(image.getAttribute('src')).toBe('/api/images/prompt?prompt=Coffee&width=400&height=400')
  }
})

it('fades in only the currently loaded source when the item changes', () => {
  const { rerender } = render(<ProgressiveImage directUrl="https://cdn.test/a.png" alt="Photo" />)
  const image = screen.getAllByAltText('Photo')[1]
  expect(image.className).toContain('opacity-0')
  fireEvent.load(image)
  expect(image.className).toContain('opacity-100')
  rerender(<ProgressiveImage directUrl="https://cdn.test/b.png" alt="Photo" />)
  expect(image.className).toContain('opacity-0')
})