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
  expect(screen.getAllByAltText('Photo')[1].className).toContain('opacity-0')
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
    'https://app.makinari.com/api/images/prompt?prompt=Coffee&width=400&height=256&public=1 1.5x, https://app.makinari.com/api/images/prompt?prompt=Tea&width=800&height=512&public=1 2x',
  )
})

it('shows a sharp, visible placeholder when both progressive layers fail', () => {
  const onError = jest.fn()
  const onLoad = jest.fn()
  render(<ProgressiveImage item={{ name: 'Coffee' }} alt="Coffee" onError={onError} onLoad={onLoad} />)
  const [preview, image] = screen.getAllByAltText('Coffee')
  fireEvent.error(preview)
  fireEvent.error(image)
  expect(preview).toHaveAttribute('src', '/images/image-placeholder.svg')
  expect(preview).toHaveClass('data-[image-fallback=true]:blur-none', 'data-[image-fallback=true]:scale-100')
  expect(image).toHaveAttribute('src', '/images/image-placeholder.svg')
  expect(image).not.toHaveAttribute('srcset')
  expect(image).toHaveClass('opacity-100')
  expect(image.style.opacity).not.toBe('0')
  fireEvent.load(image)
  expect(onLoad).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledTimes(1)
})

it('loads a new progressive source normally after a failed image', () => {
  const { rerender } = render(<ProgressiveImage directUrl="/broken.jpg" alt="Photo" />)
  fireEvent.error(screen.getAllByAltText('Photo')[1])
  rerender(<ProgressiveImage directUrl="/new.jpg" alt="Photo" />)
  const image = screen.getAllByAltText('Photo')[1]
  expect(image).toHaveAttribute('src', '/new.jpg')
  expect(image).toHaveClass('opacity-0')
  fireEvent.load(image)
  expect(image).toHaveClass('opacity-100')
})

it('renders a placeholder even when no progressive source is available', () => {
  render(<ProgressiveImage alt="Missing" className="w-full h-full" />)
  expect(screen.getByAltText('Missing')).toHaveAttribute('src', '/images/image-placeholder.svg')
})