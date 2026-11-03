import { render, screen } from '@testing-library/react'
import { RequirementRunnerBanner } from '@/app/robots/requirement-runner-banner'
import { requirementIdFromRobotName, linkedRunnerId } from '@/app/robots/requirement-runner-link'

const req = '11111111-1111-4111-8111-111111111111'
const runnerId = '22222222-2222-4222-8222-222222222222'
const mockSWR = jest.fn()
const mockInstances = jest.fn()
const mockClient = jest.fn()
jest.mock('swr', () => ({ __esModule: true, default: (...args: unknown[]) => mockSWR(...args) }))
jest.mock('@/app/context/RobotsContext', () => ({ useRobots: () => ({ getAllInstances: mockInstances }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => mockClient() }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(AbortSignal, 'timeout', { configurable: true, value: jest.fn(() => new AbortController().signal) })
  mockSWR.mockReturnValue({ data: { runnerId }, error: null })
  mockInstances.mockReturnValue([{ id: runnerId, site_id: 'site', name: `req-runner-${req}`, is_archived: false }])
})
const view = (id = 'qa', name = `req-maint-${req}`) => render(<RequirementRunnerBanner instance={{ id, name }} siteId="site" />)

it('links QA history to the existing executor feedback conversation without dispatch', () => {
  view()
  expect(screen.getByRole('link', { name: 'Open executor and send feedback' })).toHaveAttribute('href', expect.stringContaining(`instance=${runnerId}`))
  expect(screen.getByRole('link', { name: 'View requirement' })).toHaveAttribute('href', `/requirements/${req}`)
  expect(mockInstances).toHaveBeenCalledWith(true)
  expect(mockClient).not.toHaveBeenCalled()
})

it('does not show a handoff when already viewing the unarchived executor', () => {
  view(runnerId, `req-runner-${req}`)
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
})

it('shows an archived executor explicitly without restoring it or offering a send link', () => {
  mockInstances.mockReturnValue([{ id: runnerId, site_id: 'site', is_archived: true }])
  view()
  expect(screen.getByText(/linked executor is archived/)).toBeInTheDocument()
  expect(screen.queryByText('Open executor and send feedback')).not.toBeInTheDocument()
})

it('does not expose an executor from another tenant or invent a replacement', () => {
  mockInstances.mockReturnValue([{ id: runnerId, site_id: 'other', is_archived: false }])
  view()
  expect(screen.getByText(/No replacement has been started/)).toBeInTheDocument()
  expect(screen.queryByText('Open executor and send feedback')).not.toBeInTheDocument()
})

it('distinguishes lookup failure from a confirmed link', () => {
  mockSWR.mockReturnValue({ error: new Error('offline'), data: undefined })
  view()
  expect(screen.getByText(/could not be checked/)).toBeInTheDocument()
})

it('validates legacy name and metadata identities and leaves unrelated robots alone', () => {
  expect(requirementIdFromRobotName(`req-maint-${req}`)).toBe(req)
  expect(requirementIdFromRobotName('req-maint-invalid')).toBeNull()
  expect(linkedRunnerId({ runner_instance_id: 'invalid' })).toBeNull()
  expect(linkedRunnerId({ runner_instance_id: runnerId })).toBe(runnerId)
  view('free', 'Free Agent')
  expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  expect(mockSWR.mock.calls[0][0]).toBeNull()
})

it('reads the binding under user RLS with an explicit tenant and bounded timeout', async () => {
  const query = { select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), maybeSingle: jest.fn() }
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.abortSignal.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { metadata: { runner_instance_id: runnerId } }, error: null })
  const from = jest.fn(() => query)
  mockClient.mockReturnValue({ from })
  view()
  expect(await mockSWR.mock.calls[0][1](['requirement-runner-link', 'site', req])).toEqual({ runnerId })
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site')
  expect(query.eq).toHaveBeenCalledWith('id', req)
  expect(query.select).toHaveBeenCalledWith('metadata')
  expect(query.abortSignal).toHaveBeenCalled()
})