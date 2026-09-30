import { readFileSync } from 'fs'
import path from 'path'
import { startSiteSetup } from '@/app/create-site/start-site-setup'
import { apiClient } from '@/app/services/api-client-service'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { post: jest.fn() } }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('starts optional setup with the user session, not browser API keys', async () => {
  jest.mocked(apiClient.post).mockResolvedValue({ success: true })
  await startSiteSetup('site-1')
  expect(apiClient.post).toHaveBeenCalledWith('/api/site/setup', { site_id: 'site-1' }, { timeout: 15_000 })
  const source = readFileSync(path.join(process.cwd(), 'app/create-site/page.tsx'), 'utf8')
  expect(source).toContain('void startSiteSetup(newSite.id)')
  expect(source).not.toMatch(/NEXT_PUBLIC_API_KEY|NEXT_PUBLIC_API_SECRET|postWithApiKeys/)
})

it('does not block successful site creation or replay failed setup', async () => {
  jest.mocked(apiClient.post).mockRejectedValueOnce(new Error('private backend details'))
  await expect(startSiteSetup('site-1')).resolves.toBeUndefined()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(console.warn).toHaveBeenCalledWith('Site setup was not confirmed. Check its status before retrying.')
})