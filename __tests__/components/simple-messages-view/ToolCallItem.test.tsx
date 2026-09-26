import { render, screen } from '@testing-library/react'
import { ToolCallItem } from '@/app/components/simple-messages-view/components/ToolCallItem'
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