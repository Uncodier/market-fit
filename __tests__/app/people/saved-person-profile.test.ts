import { savedPersonProfile } from '@/app/api/finder/lists/[id]/members/saved-person-profile'

it.each(['flat', 'nested'])('projects %s lead profiles without contact or audit payloads', format => {
  const person = { id: 42, photo: 'javascript:alert(1)', headline: ['Manufacturing'], description: 'Plant leadership', email: 'secret@example.test' }
  const result = savedPersonProfile('42', { name: 'Alice', position: 'Director', company: { id: 7, name: 'Factory' },
    profile: { ...(format === 'flat' ? person : { person }),
      organization: { id: 7, name: 'Factory', website: 'https://factory.example.test', industries: [{ name: 'Manufacturing' }] },
      errors: ['private'], provider_responses: { secret: true } } })
  expect(result.person).toMatchObject({ id: '42', full_name: 'Alice', photo: null, headline: 'Manufacturing', description: 'Plant leadership' })
  expect(result.organization).toMatchObject({ name: 'Factory', website: 'https://factory.example.test/', industries: ['Manufacturing'] })
  expect(JSON.stringify(result)).not.toMatch(/secret|private|email|provider_responses/)
})

it('does not use another identity’s raw document', () => {
  const result = savedPersonProfile('42', { name: 'Actual person', profile: { person: { id: 999, headline: 'Wrong identity' } } })
  expect(result.person.full_name).toBe('Actual person')
  expect(result.person.headline).toBeNull()
})

it('uses the exact company and role, not the first current role or a conflicting same-name organization', () => {
  const result = savedPersonProfile('42', { name: 'Alice', position: 'Director', company: { id: 7, name: 'Factory' },
    profile: { id: 42, roles: [
      { role_title: 'Director', is_current: true, organization: { id: 99, name: 'Factory', website: 'https://wrong.example.test' } },
      { role_title: 'Previous title', is_current: true, organization: { id: 7, name: 'Factory', website: 'https://old.example.test' } },
      { role_title: 'Director', role_description: 'Correct role', start_date: '2020-01-01', organization: { id: 7, name: 'Factory', website: 'https://correct.example.test' } },
    ] } })
  expect(result.organization).toMatchObject({ id: '7', name: 'Factory', website: 'https://correct.example.test/' })
  expect(result).toMatchObject({ role_title: 'Director', role_description: 'Correct role', start_date: '2020-01-01' })
})

it('leaves company metadata absent when no role belongs to the linked company', () => {
  const result = savedPersonProfile('42', { name: 'Alice', position: 'Director', company: { id: 7, name: 'Factory' },
    profile: { id: 42, roles: [{ role_title: 'Director', organization: { id: 99, name: 'Factory', website: 'https://wrong.example.test' } }] } })
  expect(result.organization).toMatchObject({ id: '7', name: 'Factory', website: null })
})

it('falls back to an authorized linked lead or provider ID when no profile exists', () => {
  expect(savedPersonProfile('opaque:person', { name: 'Alice', position: 'Director' }).person.full_name).toBe('Alice')
  expect(savedPersonProfile('opaque:person', null).person.full_name).toBe('opaque:person')
})