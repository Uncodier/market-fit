import { render, screen } from '@testing-library/react'
import { ToolCallItem } from '@/app/components/simple-messages-view/components/ToolCallItem'
import { getToolLogPlainTextForCopy } from '@/app/components/simple-messages-view/utils'
import { getProcessActivity } from '@/app/components/simple-messages-view/group-timeline-process'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

jest.mock('@/app/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))
jest.mock('@/app/components/simple-messages-view/components/InstanceLogCopyFeedbackBar', () => ({
  InstanceLogCopyFeedbackBar: () => null,
}))

const baseLog: InstanceLog = {
  id: 'screenshot-log',
  log_type: 'tool_result',
  level: 'error',
  message: 'Screenshot failed',
  tool_name: 'screenshot',
  created_at: '2026-09-25T12:00:00.000Z',
}

function renderTool(log: InstanceLog) {
  return render(
    <ToolCallItem
      log={log}
      isDarkMode={false}
      collapsedToolDetails={new Set()}
      onToggleToolDetails={jest.fn()}
    />,
  )
}

describe('ToolCallItem screenshot failures', () => {
  it('renders structured output errors without passing objects as React children', () => {
    renderTool({
      ...baseLog,
      tool_result: { success: false, output: { path: '/tmp/screenshot.png', message: 'Screenshot unavailable' } },
    })

    expect(screen.getAllByText(/Screenshot unavailable/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\/tmp\/screenshot.png/).length).toBeGreaterThan(0)
  })

  it('keeps plain string error messages visible', () => {
    renderTool({ ...baseLog, tool_result: { error: 'Browser disconnected' } })
    expect(screen.getByText('Browser disconnected')).toBeInTheDocument()
  })
})

describe('private Robots tool logs', () => {
  it.each([
    [{ action: 'call', private_arguments: true, tool_origin: 'provider' }, 'Call: Provider connector'],
    [{ action: 'describe', private_arguments: true, tool_origin: 'makinari_report' }, 'Describe: Internal Makinari report'],
    [{ action: 'search', private_arguments: true, tool_origin: 'private-canary' }, 'Search: Private tools'],
    [{ action: 'call', name: 'report:private-canary', args: 'private-canary' }, 'Call: Internal Makinari report'],
    [{ action: 'list' }, 'List: Private tools'],
  ] as const)('uses only the safe label and outcome, including expanded details and copy text', (tool_args, label) => {
    const log: InstanceLog = { ...baseLog, tool_name: 'tools', tool_args,
      message: 'tools: action=private-canary, name=private-canary, thought_process=private-canary',
      details: { account_label: 'private-canary' }, tool_result: { success: false, error: 'private-canary',
        output: { tools: [{ name: 'connector:private-canary', connector_id: 'private-canary' }] } } }
    const { container } = renderTool(log)
    expect(container.textContent).toContain(label)
    expect(container.innerHTML).not.toContain('private-canary')
    expect(getProcessActivity(log)).toEqual({ label: `Tool call: ${label}`, kind: 'tool' })
    const copied = getToolLogPlainTextForCopy(log)
    expect(copied).toContain(label)
    expect(copied).not.toContain('private-canary')
  })
})