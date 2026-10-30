/** @jest-environment node */
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isProcurementPortalDemo } from '@/app/tenders/demo-mode'
import { loadPublicTenders } from '@/app/tenders/public-data'
import { loadTenderSiteIdentity, loadTenderSiteIdentities } from '@/app/tenders/site-identity'
import { demoPublicTenders, demoTenderRows, demoPortalOpportunities, demoPortalSubmissions } from '@/lib/demo-data/procurement-portal'

jest.mock('server-only', () => ({}))
jest.mock('next/headers', () => ({ cookies: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/app/book/site-by-slug', () => ({ resolveSiteInfoBySlug: jest.fn(), toSiteSlug: jest.fn() }))

function cookie(value?: string) {
  jest.mocked(cookies).mockResolvedValue({ get: () => value ? { value } : undefined } as never)
}
beforeEach(() => { jest.clearAllMocks(); cookie('demo-saas-en-123') })

it('uses the explicit cookie only as a presentation selector', async () => {
  expect(await isProcurementPortalDemo()).toBe(true)
  cookie('demo%2Dsaas-en-123'); expect(await isProcurementPortalDemo()).toBe(true)
  for (const value of [undefined, 'real-workspace', '%invalid', 'true']) {
    cookie(value); expect(await isProcurementPortalDemo()).toBe(false)
  }
})

it('loads public directory, site and detail without creating any database clients', async () => {
  expect((await loadPublicTenders()).rows).toEqual(demoPublicTenders)
  expect((await loadPublicTenders('demo-procurement', 'demo-tender-workplace')).rows).toHaveLength(1)
  expect((await loadPublicTenders('demo-procurement', 'demo-tender-awarded')).rows[0].status).toBe('closed')
  expect((await loadPublicTenders('demo-procurement', 'demo-tender-sealed')).rows[0].snapshot).toMatchObject({ participation: 'open', opening_policy: 'after_close' })
  expect((await loadPublicTenders('real-site')).rows).toEqual([])
  expect(await loadTenderSiteIdentity('demo-procurement')).toMatchObject({ name: 'Acme Workplace' })
  expect(await loadTenderSiteIdentity('real-site')).toBeNull()
  expect((await loadTenderSiteIdentities(['demo-procurement'])).size).toBe(1)
  expect(createClient).not.toHaveBeenCalled()
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('preserves real validation when the demo cookie is absent', async () => {
  cookie()
  expect(await loadPublicTenders('demo-procurement', 'demo-tender-workplace')).toEqual({ rows: [], error: 'Invalid tender filters.' })
  expect(createClient).not.toHaveBeenCalled()
})

it('filters and paginates fixtures with consistent shared IDs and amounts', () => {
  expect(demoTenderRows(undefined, undefined, 0, 'renewal')).toHaveLength(1)
  expect(demoTenderRows(undefined, undefined, 1)).toEqual([])
  expect(demoTenderRows(undefined, undefined, -1)).toEqual([])
  expect(demoTenderRows(undefined, 'unknown')).toEqual([])
  expect(demoPortalOpportunities[0]).toMatchObject({ tender_id: 'demo-tender-workplace', supplier_id: 'demo-supplier-northstar' })
  expect(demoPortalSubmissions[0]).toMatchObject({ id: 'demo-quote-northstar', net_amount_minor: 600000, tax_amount_minor: 48000 })
})