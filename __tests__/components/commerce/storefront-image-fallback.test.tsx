import { fireEvent, render, screen } from '@testing-library/react'
import type { CatalogItem, VariantAxis } from '@/app/types'
import { CatalogListingCard } from '@/app/components/commerce/CatalogListingCard'
import { PromoListingCard } from '@/app/components/commerce/PromoListingCard'
import { PromoBundleExperience, type PromoBundleData } from '@/app/components/commerce/PromoBundleExperience'
import { ModifierPickerPanel } from '@/app/components/commerce/ModifierPickerPanel'
import { PdpProductGallery } from '@/app/components/commerce/pdp/PdpProductGallery'
import { VariantPicker } from '@/app/components/commerce/pdp/VariantPicker'
import { PublicImageDelivery } from '@/app/components/commerce/PublicImageDelivery'
import { ShopDeviceOrders } from '@/app/shop/[siteSlug]/ShopDeviceOrders'
import type { StorefrontPromoCard } from '@/app/promotions/promotion-merchandising'
import type { ModifierGroupWithItems } from '@/app/catalog/modifier-types'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: 'en' }),
}))
jest.mock('@/app/context/DisplayCurrencyContext', () => ({
  useDisplayCurrency: () => ({ formatPrice: (price: number) => `$${price}` }),
}))
jest.mock('@/app/components/commerce/quick-apply-storefront-promo', () => ({ quickApplyStorefrontPromo: jest.fn() }))
jest.mock('@/app/commerce/device-order-snapshots', () => ({
  getDeviceOrderSnapshots: jest.fn(async () => ({ data: [], error: null })),
}))
jest.mock('@/app/commerce/cart-storage', () => ({ getCartItems: () => [], setCartItems: jest.fn() }))
jest.mock('@/app/components/commerce/PromoStorefrontShell', () => ({
  PromoStorefrontShell: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}))

const item: CatalogItem = {
  id: 'product', site_id: 'site', name: 'Red rose', kind: 'product',
  status: 'active', target_sale_price: 10, track_inventory: false,
  availability_mode: 'always', availability_status: 'available', sort_order: 0,
  is_pos_available: true, is_recurring: false, is_reservation: false,
  created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z',
}
const promo: StorefrontPromoCard = {
  id: 'promotion', site_id: 'site', name: 'Rose offer', discount_type: 'percent',
  discount_value: 10, catalog_item_ids: [], category_ids: [],
}
const placeholder = 'https://app.makinari.com/images/image-placeholder.svg'

function assertFallback(image: HTMLImageElement) {
  fireEvent.error(image)
  expect(image).toHaveAttribute('src', placeholder)
  expect(image).not.toHaveAttribute('srcset')
  expect(image.style.opacity).not.toBe('0')
}

it.each(['shop', 'marketplace'] as const)('keeps %s product cards visible and actionable after image failure', surface => {
  const onPrimaryAction = jest.fn()
  const href = `/${surface}/product`
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <CatalogListingCard item={item} href={href} onPrimaryAction={onPrimaryAction} showSeller={surface === 'marketplace'} />
  </PublicImageDelivery>)
  const images = container.querySelectorAll<HTMLImageElement>('img')
  expect(images).toHaveLength(2)
  images.forEach(assertFallback)
  expect(images[1]).toHaveClass('opacity-100')
  expect(screen.getByRole('link', { name: 'Red rose' })).toHaveAttribute('href', href)
  fireEvent.click(screen.getByRole('button'))
  expect(onPrimaryAction).toHaveBeenCalledWith(item)
})

it.each(['shop', 'marketplace'] as const)('shows %s promotion artwork instead of hiding a failed hero', surface => {
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <PromoListingCard promo={promo} href={`/${surface}/promo/promotion`} surface={surface} />
  </PublicImageDelivery>)
  assertFallback(container.querySelector('img')!)
  expect(screen.getByRole('button')).toBeEnabled()
})

it.each(['shop', 'marketplace'] as const)('shows placeholder in the %s promotion detail hero', surface => {
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <PromoBundleExperience promo={promo as PromoBundleData} backHref={`/${surface}`} surface={surface} />
  </PublicImageDelivery>)
  assertFallback(container.querySelector('img')!)
  expect(screen.getByRole('heading', { name: 'Rose offer' })).toBeInTheDocument()
})

it('replaces failed PDP images without breaking thumbnail selection', () => {
  const onThumbClick = jest.fn()
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <PdpProductGallery itemName="Red rose" mainSrc="/missing.jpg" entries={[{ url: '/missing.jpg' }, { url: '/missing-2.jpg' }]}
      selectedIndex={0} onThumbClick={onThumbClick} />
  </PublicImageDelivery>)
  container.querySelectorAll<HTMLImageElement>('img').forEach(assertFallback)
  fireEvent.click(screen.getAllByRole('button')[1])
  expect(onThumbClick).toHaveBeenCalledWith(1)
})

it('uses neutral artwork for a failed variant instead of retrying another generated URL', () => {
  const axes: VariantAxis[] = [{ id: 'size', kind: 'custom', label: 'Size', values: [{ id: 'small', label: 'Small' }] }]
  const onOptionSelect = jest.fn()
  const child = { ...item, id: 'variant', metadata: { option_values: { size: 'small' } } }
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <VariantPicker axes={axes} selectedOptions={{}} childrenItems={[child]} onOptionSelect={onOptionSelect}
      fallbackImageUrl="/api/images/prompt?prompt=Parent" />
  </PublicImageDelivery>)
  assertFallback(container.querySelector('img')!)
  fireEvent.click(screen.getByRole('button'))
  expect(onOptionSelect).toHaveBeenCalledWith('size', 'small')
})

it('shows modifier placeholders without disabling option selection', () => {
  const groups: ModifierGroupWithItems[] = [{ id: 'extras', site_id: 'site', name: 'Extras', min_select: 0, max_select: 1, sort_order: 0,
    items: [{ id: 'extra', catalog_item_id: 'ribbon', sort_order: 0, name: 'Ribbon', price: 2 }] }]
  const onChange = jest.fn()
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <ModifierPickerPanel groups={groups} onChange={onChange} />
  </PublicImageDelivery>)
  assertFallback(container.querySelector('img')!)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ catalogItemId: 'ribbon', cartQty: 1 })])
})

it.each([1, 2, 3, 4])('keeps placeholders visible in a %s-item saved-order mosaic', count => {
  const { container } = render(<PublicImageDelivery delivery={{ scope: 'public', origin: 'https://app.makinari.com' }}>
    <ShopDeviceOrders siteId="site" orders={[{ orderId: 'order', publicAccessToken: 'public-token',
      items: Array.from({ length: count }, (_, i) => ({ name: `Rose ${i}`, imageUrl: `/missing-${i}.jpg` })) }]} />
  </PublicImageDelivery>)
  const images = container.querySelectorAll<HTMLImageElement>('img')
  expect(images).toHaveLength(count)
  images.forEach(assertFallback)
})