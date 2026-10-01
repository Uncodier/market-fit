import { createClient } from '@/lib/supabase/client'
import { mutate } from 'swr'
import { subscribeRequirementExecutionRealtime } from '@/app/components/simple-messages-view/hooks/subscribeRequirementStatusRealtime'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('swr', () => ({ mutate: jest.fn() }))

it('shares one filtered channel, debounces events, and removes it only after the last consumer leaves', () => {
  jest.useFakeTimers()
  const on = jest.fn()
  const channel = { on, subscribe: jest.fn() }
  on.mockReturnValue(channel)
  channel.subscribe.mockReturnValue(channel)
  const createChannel = jest.fn(() => channel)
  const removeChannel = jest.fn()
  ;(createClient as jest.Mock).mockReturnValue({ channel: createChannel, removeChannel })
  const first = subscribeRequirementExecutionRealtime('instance', 'requirement')
  const second = subscribeRequirementExecutionRealtime('instance', 'requirement')
  expect(createChannel).toHaveBeenCalledTimes(1)
  expect(on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'requirements', filter: 'id=eq.requirement' }), expect.any(Function))
  on.mock.calls[0][2]()
  on.mock.calls[0][2]()
  jest.advanceTimersByTime(200)
  expect(mutate).toHaveBeenCalledTimes(1)
  expect(mutate).toHaveBeenCalledWith(['requirement_status', 'instance'])
  first()
  expect(removeChannel).not.toHaveBeenCalled()
  second()
  expect(removeChannel).toHaveBeenCalledTimes(1)
  jest.useRealTimers()
})