import { fireEvent, render, screen } from '@testing-library/react'
import { PromptImage } from '@/app/components/commerce/PromptImage'
import { PublicImageDelivery } from '@/app/components/commerce/PublicImageDelivery'
import { IMAGE_PLACEHOLDER_PATH } from '@/app/lib/prompt-image-url'

it.each([undefined, '', '   '])('renders neutral artwork for missing source %s', src => {
  render(<PromptImage src={src} alt="Product" className="w-full h-full object-cover" />)
  const image = screen.getByAltText('Product')
  expect(image).toHaveAttribute('src', IMAGE_PLACEHOLDER_PATH)
  expect(image).toHaveAttribute('data-image-fallback', 'true')
  expect(image).toHaveClass('w-full', 'h-full', 'object-cover')
})

it.each([
  '/api/images/prompt?prompt=Generation-failed',
  '/api/images/prompt?prompt=Insufficient-credits',
  '/missing-upload.jpg',
])('replaces failed image %s without replaying its request', src => {
  const onError = jest.fn()
  render(<PromptImage src={src} srcSet={`${src} 1x, /other.jpg 2x`} alt="Product" onError={onError} />)
  const image = screen.getByAltText('Product')
  fireEvent.error(image)
  expect(image).toHaveAttribute('src', IMAGE_PLACEHOLDER_PATH)
  expect(image).not.toHaveAttribute('srcset')
  expect(onError).toHaveBeenCalledTimes(1)
  fireEvent.error(image)
  expect(image).toHaveAttribute('src', IMAGE_PLACEHOLDER_PATH)
  expect(image).not.toHaveAttribute('srcset')
})

it('tries new src and srcset values after an earlier source failed', () => {
  const { rerender } = render(<PromptImage src="/product.jpg" srcSet="/old.jpg 2x" alt="Product" />)
  fireEvent.error(screen.getByAltText('Product'))
  rerender(<PromptImage src="/product.jpg" srcSet="/new.jpg 2x" alt="Product" />)
  expect(screen.getByAltText('Product')).toHaveAttribute('src', '/product.jpg')
  expect(screen.getByAltText('Product')).toHaveAttribute('srcset', '/new.jpg 2x')
  fireEvent.error(screen.getByAltText('Product'))
  rerender(<PromptImage src="/new-product.jpg" alt="Product" />)
  expect(screen.getByAltText('Product')).toHaveAttribute('src', '/new-product.jpg')
  expect(screen.getByAltText('Product')).not.toHaveAttribute('data-image-fallback')
})

it('does not revert to the failed request on an unrelated rerender', () => {
  const { rerender } = render(<PromptImage src="/missing.jpg" alt="Product" />)
  fireEvent.error(screen.getByAltText('Product'))
  rerender(<PromptImage src="/missing.jpg" alt="Updated product" />)
  expect(screen.getByAltText('Updated product')).toHaveAttribute('src', IMAGE_PLACEHOLDER_PATH)
})

it('delivers fallback artwork from the app host on the separate www storefront', () => {
  render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <PromptImage src="/api/images/prompt?prompt=Coffee" alt="Coffee" />
  </PublicImageDelivery>)
  const image = screen.getByAltText('Coffee')
  fireEvent.error(image)
  expect(image).toHaveAttribute('src', `https://app.makinari.com${IMAGE_PLACEHOLDER_PATH}`)
})

it('recovers a completed broken image whose error happened before handlers attached', () => {
  const complete = jest.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
  const naturalWidth = jest.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(0)
  try {
    render(<PromptImage src="/pre-hydration-failure.jpg" alt="Product" />)
    expect(screen.getByAltText('Product')).toHaveAttribute('src', IMAGE_PLACEHOLDER_PATH)
  } finally {
    complete.mockRestore()
    naturalWidth.mockRestore()
  }
})