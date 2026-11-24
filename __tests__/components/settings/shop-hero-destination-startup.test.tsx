import { act, fireEvent, render, screen } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { listCatalogCategories, listCatalogItems } from '@/app/catalog/actions'
import { useShopSection } from '@/app/components/settings/use-shop-section'
import { ShopHeroCard } from '@/app/components/settings/ShopHeroCard'
import type { SiteFormValues } from '@/app/components/settings/form-schema'

jest.mock('@/app/assets/actions', () => ({ uploadAssetFile: jest.fn() }))
jest.mock('@/app/catalog/actions', () => ({ listCatalogCategories: jest.fn(), listCatalogItems: jest.fn() }))

const save = jest.fn()
function Fields({ siteId }: { siteId: string }) {
  return <ShopHeroCard {...useShopSection({ active: true, siteId, onSave: save })} />
}
function Settings({ siteId, initialType = 'scroll' }: { siteId: string; initialType?: 'scroll' | 'item' }) {
  const form = useForm<SiteFormValues>({ defaultValues: { shop: { hero_cta_destination_type: initialType,
    hero_cta_destination_value: initialType === 'item' ? 'previous-item' : '' } } })
  return <FormProvider {...form}><Fields siteId={siteId} /></FormProvider>
}
const item = (id: string, listed = true, parent: string | null = null) => ({ id, name: id, parent_id: parent, is_marketplace_listed: listed })
const itemResponse = (items: ReturnType<typeof item>[]) => ({ data: items, count: items.length }) as Awaited<ReturnType<typeof listCatalogItems>>
const chooseKind = (kind: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Call to Action Destination' }), { target: { value: kind } })
beforeEach(() => jest.clearAllMocks())

it('loads neither catalog on normal startup, then only the directory consumed by the visible field', async () => {
  jest.mocked(listCatalogCategories).mockResolvedValue({ data: [{ id: 'cat', name: 'Travel' }] } as never)
  jest.mocked(listCatalogItems).mockResolvedValue(itemResponse([item('listed'), item('variant', true, 'listed'), item('unlisted', false)]))
  render(<Settings siteId="site-a" />)
  chooseKind('url')
  expect(listCatalogItems).not.toHaveBeenCalled()
  expect(listCatalogCategories).not.toHaveBeenCalled()
  chooseKind('category')
  expect(await screen.findByRole('option', { name: 'Travel' })).toHaveValue('Travel')
  expect(jest.mocked(listCatalogCategories).mock.calls).toEqual([['site-a']])
  expect(listCatalogItems).not.toHaveBeenCalled()
  chooseKind('item')
  expect(await screen.findByRole('option', { name: 'listed' })).toHaveValue('listed')
  expect(listCatalogItems).toHaveBeenCalledTimes(1)
  expect(listCatalogItems).toHaveBeenCalledWith({ siteId: 'site-a', pageSize: 1000 })
  expect(screen.queryByText('unlisted')).toBeNull()
  expect(screen.queryByText('variant')).toBeNull()
  expect(save).not.toHaveBeenCalled()
})

it('retains the saved value on failure and ignores a late old-site retry', async () => {
  let deliver!: (value: Awaited<ReturnType<typeof listCatalogItems>>) => void
  jest.mocked(listCatalogItems).mockResolvedValueOnce({ data: [], error: 'not available', count: 0 })
    .mockReturnValueOnce(new Promise(resolve => { deliver = resolve }))
    .mockResolvedValueOnce(itemResponse([item('site-b-item')]))
  const view = render(<Settings key="a" initialType="item" siteId="a" />)
  await screen.findByRole('alert')
  expect(screen.getByRole('combobox', { name: 'Select Item' })).toHaveValue('previous-item')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  view.rerender(<Settings key="b" initialType="item" siteId="b" />)
  await screen.findByRole('option', { name: 'site-b-item' })
  await act(async () => deliver(itemResponse([item('site-a-item')])))
  expect(screen.queryByRole('option', { name: 'site-a-item' })).toBeNull()
  expect(listCatalogCategories).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})