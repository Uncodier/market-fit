/** @jest-environment node */
import { groupOpportunities } from '@/app/home/submissions/opportunity-groups'
import type { Opportunity } from '@/app/home/submissions/types'

const opportunity = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  site_id: 'buyer-site',
  supplier_id: 'supplier-one',
  supplier_name: 'Supplier One',
  acting_as_self: false,
  acting_site_id: 'supplier-site-one',
  tender_id: 'tender-one',
  publication_id: 'publication-one',
  version: 1,
  title: 'Published tender',
  description: 'Buyer-authored requirements',
  currency: 'EUR',
  visibility: 'public',
  participation: 'open',
  participation_deadline: '2027-01-01T00:00:00Z',
  opening_at: '2027-01-02T00:00:00Z',
  opening_policy: 'at_opening',
  requirements: [{ id: 'requirement-one', description: 'Delivery', quantity: 1, unit: 'unit' }],
  ...overrides,
})

describe('groupOpportunities', () => {
  test('returns empty groups and an empty choices map for no opportunities', () => {
    expect(groupOpportunities([])).toEqual({ public: [], restricted: [], choices: new Map() })
  })

  test('deduplicates public publications and prefers the personal applicant even when listed last', () => {
    const businessOne = opportunity()
    const businessTwo = opportunity({ supplier_id: 'supplier-two', supplier_name: 'Supplier Two', acting_site_id: 'supplier-site-two' })
    const personal = opportunity({ supplier_id: null, supplier_name: 'My account', acting_as_self: true, acting_site_id: null })
    const result = groupOpportunities([businessOne, businessTwo, personal])

    expect(result.public).toEqual([personal])
    expect(result.public[0]).toBe(personal)
    expect(result.restricted).toEqual([])
    expect(result.choices.get('publication-one')).toHaveLength(3)
    expect(result.choices.get('publication-one')).toEqual(expect.arrayContaining([personal, businessOne, businessTwo]))
  })

  test('keeps the first business representative when no personal applicant exists', () => {
    const first = opportunity()
    const second = opportunity({ supplier_id: 'supplier-two', acting_site_id: 'supplier-site-two' })
    const result = groupOpportunities([first, second])

    expect(result.public).toEqual([first])
    expect(result.choices.get('publication-one')).toEqual(expect.arrayContaining([first, second]))
    expect(result.choices.get('publication-one')).toHaveLength(2)
  })

  test('deduplicates by publication ID, not tender ID or title', () => {
    const first = opportunity()
    const secondVersion = opportunity({ publication_id: 'publication-two', version: 2 })
    const result = groupOpportunities([first, secondVersion, opportunity({ supplier_id: 'supplier-two', acting_site_id: 'supplier-site-two' })])

    expect(result.public).toEqual([first, secondVersion])
    expect(result.choices.get('publication-one')).toHaveLength(2)
    expect(result.choices.get('publication-two')).toEqual([secondVersion])
  })

  test('offers the same authorized business only once per public publication', () => {
    const first = opportunity()
    const repeatedBusiness = opportunity({ supplier_id: 'another-buyer-relationship' })
    const result = groupOpportunities([first, repeatedBusiness])

    expect(result.public).toEqual([first])
    expect(result.choices.get('publication-one')).toEqual([first])
  })

  test.each([
    ['private', 'open'],
    ['closed', 'open'],
    ['public', 'invitation_only'],
    ['public', 'approved_suppliers'],
    ['private', 'invitation_only'],
    ['private', 'approved_suppliers'],
    ['unknown', 'open'],
    ['public', 'unknown'],
    [undefined, 'open'],
    ['public', undefined],
    [undefined, undefined],
  ])('fails closed to restricted for visibility=%s and participation=%s', (visibility, participation) => {
    const row = opportunity({ visibility, participation })
    const result = groupOpportunities([row])

    expect(result.public).toEqual([])
    expect(result.restricted).toEqual([row])
    expect(result.restricted[0]).toBe(row)
  })

  test('preserves every restricted applicant even when they share a publication', () => {
    const invitedOne = opportunity({ visibility: 'private', participation: 'invitation_only' })
    const invitedTwo = opportunity({ visibility: 'private', participation: 'invitation_only', supplier_id: 'supplier-two', acting_site_id: 'supplier-site-two' })
    const approved = opportunity({ publication_id: 'approved-publication', participation: 'approved_suppliers' })
    const result = groupOpportunities([invitedOne, invitedTwo, approved])

    expect(result.public).toEqual([])
    expect(result.restricted).toEqual([invitedOne, invitedTwo, approved])
  })

  test('does not turn a restricted applicant into a public choice because its publication ID matches', () => {
    const publicRow = opportunity({ acting_as_self: true, supplier_id: null, acting_site_id: null })
    const legacyRow = opportunity({ visibility: undefined, participation: undefined })
    const result = groupOpportunities([legacyRow, publicRow])

    expect(result.public).toEqual([publicRow])
    expect(result.restricted).toEqual([legacyRow])
    expect(result.choices.get('publication-one')).toEqual([publicRow])
  })

  test('does not mutate input order or opportunity data when selecting a representative', () => {
    const business = opportunity()
    const personal = opportunity({ acting_as_self: true, supplier_id: null, acting_site_id: null })
    const rows = [business, personal]
    const before = JSON.parse(JSON.stringify(rows))
    Object.freeze(business)
    Object.freeze(personal)
    Object.freeze(rows)

    groupOpportunities(rows)

    expect(rows).toEqual(before)
    expect(rows[0]).toBe(business)
    expect(rows[1]).toBe(personal)
  })
})