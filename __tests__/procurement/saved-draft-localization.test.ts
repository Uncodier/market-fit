import en from '@/app/context/locales/procurement/portal-en.json'
import es from '@/app/context/locales/procurement/portal-es.json'
import de from '@/app/context/locales/procurement/portal-de.json'
import fr from '@/app/context/locales/procurement/portal-fr.json'
import ja from '@/app/context/locales/procurement/portal-ja.json'

const expected = {
  'activity.description': 'Direct invitations, saved drafts and submitted quotations.',
  'activity.opportunities': 'Direct invitations',
  'draft.list': 'Drafts',
  'draft.empty': 'No saved quotation drafts.',
  'draft.resume': 'Resume draft',
  'draft.unavailable': 'This publication is no longer available for editing.',
  'draft.reference': 'Reference',
  'draft.updated': 'Last saved',
  'draft.status': 'Status',
  'draft.editable': 'Draft',
  'draft.attempted': 'Pending submission confirmation',
}

test('English saved draft and invitation labels match the portal contract', () => {
  for (const [suffix, value] of Object.entries(expected)) {
    expect((en as Record<string, string>)[`procurement.portal.${suffix}`]).toBe(value)
  }
  expect(en['procurement.portal.home.activityDescription']).toContain('saved drafts')
  expect(en['procurement.portal.activity.authorization']).not.toMatch(/account ID/i)
})

test.each([['es', es], ['de', de], ['fr', fr], ['ja', ja]])('%s includes native saved draft and invitation labels', (_locale, messages) => {
  const dictionary = messages as Record<string, string>
  for (const suffix of [...Object.keys(expected), 'home.activityDescription', 'activity.authorization', 'activity.invitationsHint']) {
    const key = `procurement.portal.${suffix}`
    expect(dictionary[key]?.trim()).toBeTruthy()
    if (suffix !== 'draft.status') expect(dictionary[key]).not.toBe((en as Record<string, string>)[key])
  }
})