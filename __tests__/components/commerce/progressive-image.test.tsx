import { fireEvent, render, screen } from '@testing-library/react'
import { ProgressiveImage } from '@/app/components/commerce/ProgressiveImage'
import { PromptImage } from '@/app/components/commerce/PromptImage'
import { PublicImageDelivery } from '@/app/components/commerce/PublicImageDelivery'

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

it('keeps native events, upload URLs and responsive descriptors intact in a public context', () => {
  const onLoad = jest.fn()
  const onError = jest.fn()
  const srcSet = 'data:image/png;base64,AAAA 1x, https://cdn.test/photo.png?crop=1,2 2x'
  render(<PublicImageDelivery delivery={{ scope: 'public', origin: null }}>
    <PromptImage src="https://cdn.test/photo.png" srcSet={srcSet} sizes="50vw" alt="Upload" loading="eager" onLoad={onLoad} onError={onError} />
  </PublicImageDelivery>)
  const image = screen.getByAltText('Upload')
  expect(image.getAttribute('src')).toBe('https://cdn.test/photo.png')
  expect(image.getAttribute('srcset')).toBe(srcSet)
  expect(image.getAttribute('sizes')).toBe('50vw')
  expect(image.getAttribute('loading')).toBe('eager')
  fireEvent.load(image)
  fireEvent.error(image)
  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledTimes(1)
})

it('normalizes persisted responsive prompt candidates while preserving density descriptors', () => {
  render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <PromptImage src="/api/images/prompt?prompt=Coffee" alt="Responsive" srcSet="https://old.test/api/public/image/prompt/Coffee?width=400&height=256&token=secret 1.5x, /api/images/prompt?prompt=Tea&width=800&height=512 2x" />
  </PublicImageDelivery>)
  expect(screen.getByAltText('Responsive').getAttribute('srcset')).toBe(
    'https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=256&cache_only=1 1.5x, https://app.makinari.com/api/images/prompt?prompt=Tea&width=800&height=512&cache_only=1 2x',
  )
})