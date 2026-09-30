import { checkApiConnection, diagnoseApiConnection } from '@/app/services/ai-connection-diagnostics'
import { apiClient } from '@/app/services/api-client-service'

jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: { getSession: async () => ({ data: { session: { access_token: 'user-token' } } }) },
}) }))
jest.mock('@/app/services/api-client-service', () => ({ apiClient: {
  get: jest.fn(), getApiUrl: () => 'https://api.example.test',
} }))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it.each([checkApiConnection, diagnoseApiConnection])('uses public status without API key/secret headers', async probe => {
  jest.mocked(apiClient.get).mockResolvedValue({ success: true, status: 200 })
  expect(await probe()).toMatchObject({ success: true })
  expect(apiClient.get).toHaveBeenCalledWith('/api/status', { timeout: 5000, includeAuth: false })
})