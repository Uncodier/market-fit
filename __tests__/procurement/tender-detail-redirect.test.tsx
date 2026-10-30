import Page from '@/app/tenders/[siteSlug]/[tenderSlug]/page'
import { loadTenderSiteIdentity } from '@/app/tenders/site-identity'
import { loadPublicTenders } from '@/app/tenders/public-data'
import { redirect } from 'next/navigation'

jest.mock('@/app/tenders/site-identity', () => ({ loadTenderSiteIdentity: jest.fn() }))
jest.mock('@/app/tenders/public-data', () => ({ loadPublicTenders: jest.fn(), participationClosed: jest.fn() }))
jest.mock('@/app/tenders/detail-view', () => ({ TenderDetailView: () => null }))
jest.mock('next/navigation', () => ({ redirect: jest.fn(() => { throw new Error('redirect') }), notFound: jest.fn() }))

test('canonical tender redirects retain submission intent and encoded repeated query values', async () => {
  jest.mocked(loadTenderSiteIdentity).mockResolvedValue({ slug: 'my-store', name: 'My Store', portalSlug: 'legacy' })
  await expect(Page({ params: Promise.resolve({ siteSlug: 'legacy', tenderSlug: 'tender-id' }),
    searchParams: Promise.resolve({ submit: '1', search: 'a & b', filter: ['one', 'two'], absent: undefined }),
  })).rejects.toThrow('redirect')
  expect(redirect).toHaveBeenCalledWith('/tenders/my-store/tender-id?submit=1&search=a+%26+b&filter=one&filter=two')
  expect(loadPublicTenders).not.toHaveBeenCalled()
})