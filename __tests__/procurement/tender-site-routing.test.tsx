import { render, screen } from '@testing-library/react'
import Page from '@/app/tenders/[siteSlug]/page'
import { TenderDirectoryView } from '@/app/tenders/directory-view'
import { loadTenderSiteIdentity } from '@/app/tenders/site-identity'
import { redirect, notFound } from 'next/navigation'

jest.mock('@/app/tenders/site-identity', () => ({ loadTenderSiteIdentity: jest.fn() }))
jest.mock('@/app/tenders/directory', () => ({ TenderDirectory: jest.fn(() => null) }))
jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: () => null, TenderFooter: () => null }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('redirect') }), notFound: jest.fn(() => { throw new Error('not found') }) }))
const site = { slug: 'my-store', name: 'My Store', portalSlug: '829a0941-38cd-4b12-8d46-a838023042b7' }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(loadTenderSiteIdentity).mockResolvedValue(site) })

test('old URLs redirect to the store slug while preserving search and pagination', async () => {
  await expect(Page({ params: Promise.resolve({ siteSlug: site.portalSlug }), searchParams: Promise.resolve({ page: '2', search: 'a & b' }) })).rejects.toThrow('redirect')
  expect(redirect).toHaveBeenCalledWith('/tenders/my-store?page=2&search=a+%26+b')
})
test('canonical routes carry the store name and internal query slug', async () => {
  const element = await Page({ params: Promise.resolve({ siteSlug: site.slug }), searchParams: Promise.resolve({}) })
  expect(element.props).toMatchObject({ siteSlug: site.slug, siteName: site.name, portalSlug: site.portalSlug })
  expect(redirect).not.toHaveBeenCalled()
})
test('unknown and disabled portals are not rendered as empty stores', async () => {
  jest.mocked(loadTenderSiteIdentity).mockResolvedValue(null)
  await expect(Page({ params: Promise.resolve({ siteSlug: 'unknown' }), searchParams: Promise.resolve({}) })).rejects.toThrow('not found')
  expect(notFound).toHaveBeenCalled()
})
test('empty store directories still show the store name, never its ID', () => {
  render(<TenderDirectoryView siteSlug={site.slug} siteName={site.name} rows={[]} error={null} closedIds={[]} page={0} search="" />)
  expect(screen.getByRole('heading', { name: 'My Store tenders' })).toBeInTheDocument()
  expect(screen.getByText('My Store', { exact: true })).toBeInTheDocument()
  expect(screen.queryByText(site.portalSlug)).not.toBeInTheDocument()
})