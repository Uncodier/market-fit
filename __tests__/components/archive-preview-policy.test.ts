import { archiveStorageSources } from '@/app/components/simple-messages-view/components/archive-preview-policy'

it('limits the configured project and custom domain to public Storage object paths', () => {
  expect(archiveStorageSources('https://project-ref.supabase.co')).toEqual([
    'https://db.makinari.com/storage/v1/object/public/',
    'https://project-ref.supabase.co/storage/v1/object/public/',
  ])
})

it.each([
  '', 'not a URL', 'http://project-ref.supabase.co', 'https://evil.example.com',
  'https://project-ref.supabase.co.evil.example.com', 'https://app.makinari.com',
  'https://user:password@project-ref.supabase.co', 'https://project-ref.supabase.co:8443',
  'http://localhost:54321',
])('does not broaden access for unsafe or unsupported configuration: %s', value => {
  expect(archiveStorageSources(value)).toEqual(['https://db.makinari.com/storage/v1/object/public/'])
})