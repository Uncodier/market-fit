import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { InstanceContextUsage } from '@/app/components/simple-messages-view/components/InstanceContextUsage'
import useSWR from 'swr'

jest.mock('swr', () => ({ __esModule: true, default: jest.fn() }))
const mockedSWR = useSWR as jest.Mock

const breakdown = {
  estimatedInputTokens: 1000, instructions: 200, skills: 100,
  messages: 300, toolCalls: 150, toolDefinitions: 250,
}
const usage = {
  model: 'configured', usedTokens: 1000, outputTokens: 250,
  availableTokens: 5000, reservedOutputTokens: 500,
  source: 'estimate', breakdown, measuredAt: '2026-09-25T00:00:00Z',
}
const pieTrigger = () => screen.getByRole('button', { name: /Instance context:/ })
const open = () => fireEvent.click(pieTrigger())

describe('InstanceContextUsage composition pie', () => {
  beforeEach(() => mockedSWR.mockReset())

  it('does not request context without an instance', () => {
    mockedSWR.mockReturnValue({ data: undefined })
    render(<InstanceContextUsage siteId="site" />)
    expect(mockedSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(screen.queryByRole('button', { name: /Instance context:/ })).not.toBeInTheDocument()
  })

  it('does not request context without a site', () => {
    mockedSWR.mockReturnValue({ data: undefined })
    render(<InstanceContextUsage instanceId="instance" />)
    expect(mockedSWR).toHaveBeenCalledWith(null, expect.any(Function), expect.any(Object))
    expect(screen.queryByRole('button', { name: /Instance context:/ })).not.toBeInTheDocument()
  })

  it('combines capacity and composition in one icon-only pie and opens the same chart in the modal', () => {
    mockedSWR.mockReturnValue({ data: { context: usage } })
    const submit = jest.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><InstanceContextUsage instanceId="instance" siteId="site" /></form>)
    const trigger = pieTrigger()
    expect(trigger.tagName).toBe('SPAN')
    expect(trigger).toHaveAttribute('tabindex', '0')
    expect(trigger).toHaveTextContent('')
    expect(trigger).toHaveClass('h-8', 'w-8', 'cursor-pointer')
    expect(trigger).not.toHaveClass('border', 'bg-background/95', 'shadow-sm', 'hover:opacity-80', 'hover:!bg-transparent')
    expect(trigger).not.toHaveAttribute('title')
    expect(screen.getByTestId('instance-context-pie')).toHaveAttribute('width', '32')
    expect(trigger).toHaveAccessibleName(/Next turn estimate: 1,250 of 4,500 input tokens/)
    expect(trigger).toHaveAccessibleName(/28% used/)
    expect(screen.queryByTestId('context-usage-ring')).not.toBeInTheDocument()
    expect(trigger.querySelectorAll('svg')).toHaveLength(1)
    expect(screen.getAllByTestId('instance-context-pie')).toHaveLength(1)
    expect(trigger.querySelectorAll('[data-testid^="context-sector-"]')).toHaveLength(7)
    expect(Number(screen.getByTestId('context-sector-instructions').getAttribute('data-share'))).toBeCloseTo(200 / 4500)
    expect(Number(screen.getByTestId('context-sector-output').getAttribute('data-share'))).toBeCloseTo(250 / 4500)
    const remainingShare = screen.getByTestId('context-sector-remaining').getAttribute('data-share')
    expect(Number(remainingShare)).toBeCloseTo(3250 / 4500)
    open()
    expect(submit).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveTextContent('Window used for next turn: 28%')
    expect(screen.getByRole('dialog')).toHaveTextContent('Estimated input total: 1,000 tokens')
    expect(screen.getByRole('dialog')).toHaveTextContent('Skills in instructions100')
    expect(screen.getByRole('dialog')).toHaveTextContent('Tool calls and results150')
    expect(screen.getByRole('dialog')).toHaveTextContent('Tool definitions250')
    expect(screen.getByRole('dialog')).toHaveTextContent('Messages and attachments300')
    expect(screen.getByRole('dialog')).toHaveTextContent('Instructions and other context200')
    expect(screen.getByRole('dialog')).toHaveTextContent('Last output250')
    expect(screen.getByRole('dialog')).toHaveTextContent('Free context3,250')
    expect(screen.getByRole('dialog')).toHaveTextContent('not provider measurements per category')
    expect(within(screen.getByRole('dialog')).getByTestId('context-sector-remaining')).toHaveAttribute('data-share', remainingShare)
  })

  it('shows details on hover without revealing a button surface or opening the dialog', async () => {
    mockedSWR.mockReturnValue({ data: { context: usage } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    const pie = pieTrigger()
    fireEvent.pointerEnter(pie)
    fireEvent.pointerMove(pie)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Skills in instructions100')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tool calls and results150')
    expect(screen.getByRole('tooltip')).toHaveTextContent('28% used')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Next turn estimate: 1,250 of 4,500 input tokens')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Free context3,250')
    expect(screen.getByRole('tooltip')).toHaveTextContent('gray is free context')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(pie.tagName).toBe('SPAN')
    expect(pie).not.toHaveClass('hover:!bg-transparent', 'hover:!border-0', 'hover:!shadow-none')
    expect(pie).not.toHaveAttribute('title')
    fireEvent.click(pie)
    expect(screen.getByRole('dialog')).toHaveTextContent('Estimated input total: 1,000 tokens')
  })

  it('offers the same detail on keyboard focus', async () => {
    mockedSWR.mockReturnValue({ data: { context: usage } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    act(() => { pieTrigger().focus() })
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Estimated input: 1,000 tokens')
  })

  it('shows composition only without inventing free capacity for an unverified Azure deployment', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, availableTokens: null } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.queryByTestId('context-usage-ring')).not.toBeInTheDocument()
    expect(screen.queryByTestId('context-sector-remaining')).not.toBeInTheDocument()
    expect(screen.getByTestId('context-sector-skills')).toBeInTheDocument()
    open()
    expect(screen.getByRole('dialog')).toHaveTextContent('Window capacity unverified')
    expect(screen.getByRole('dialog')).toHaveTextContent('Estimated input total: 1,000 tokens')
    expect(screen.getByRole('dialog')).toHaveTextContent('Capacity unknown; the pie shows composition only.')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('Free context')
  })

  it('does not label unreported streamed output as a measured zero', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, outputTokens: null } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.queryByTestId('context-sector-output')).not.toBeInTheDocument()
    expect(pieTrigger()).toHaveAccessibleName(/last output unknown, shown as a lower bound/)
    open()
    expect(screen.getByRole('dialog')).toHaveTextContent('Last output: Unknown (provider did not report usage)')
  })

  it('shows an explicit provider adjustment instead of pretending provider input is categorized', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, source: 'provider', usedTokens: 1200 } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(Number(screen.getByTestId('context-sector-instructions').getAttribute('data-share'))).toBeCloseTo(240 / 4500)
    open()
    expect(screen.getByRole('dialog')).toHaveTextContent('Provider total differs by 200 tokens')
    expect(screen.getByRole('dialog')).toHaveTextContent('Input: 1,200 tokens (provider)')
    expect(screen.getByRole('dialog')).toHaveTextContent('Estimated input total: 1,000 tokens')
    expect(screen.getByRole('dialog')).toHaveTextContent('Free context3,050')
    expect(screen.getByRole('dialog')).toHaveTextContent('Input slices use estimated proportions of the provider total.')
  })

  it('shows uncategorized input and capacity without fabricating categories for a legacy measurement', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, breakdown: null } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.queryByTestId('context-sector-skills')).not.toBeInTheDocument()
    expect(screen.getByTestId('context-sector-input')).toBeInTheDocument()
    expect(screen.getByTestId('context-sector-remaining')).toBeInTheDocument()
    open()
    expect(screen.getByRole('dialog')).toHaveTextContent('Breakdown unavailable for this measurement')
    expect(screen.getByRole('dialog')).toHaveTextContent('Input (breakdown unavailable)1,000')
  })

  it('distinguishes loading, no saved measurement and request errors in the dialog', () => {
    for (const result of [
      [{ isLoading: true }, 'Loading context usage.'],
      [{ data: { context: null } }, 'No context usage recorded'],
      [{ data: { context: usage }, error: new Error('HTTP 503') }, 'Unable to load context usage: HTTP 503'],
    ] as const) {
      mockedSWR.mockReturnValue(result[0])
      const { unmount } = render(<InstanceContextUsage instanceId="instance" siteId="site" />)
      expect(screen.queryByTestId('context-sector-skills')).not.toBeInTheDocument()
      expect(screen.queryByTestId('context-sector-remaining')).not.toBeInTheDocument()
      open()
      expect(screen.getByRole('dialog')).toHaveTextContent(result[1])
      unmount()
    }
  })

  it('draws a full free-context circle for a recorded empty context', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, usedTokens: 0, outputTokens: 0, breakdown: null } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.getByTestId('context-sector-remaining').tagName).toBe('circle')
    expect(screen.getByTestId('context-sector-remaining')).toHaveAttribute('data-share', '1')
    expect(pieTrigger()).toHaveAccessibleName(/0% used/)
  })

  it('keeps a single-category full context visible as a circle, not an empty SVG arc', () => {
    mockedSWR.mockReturnValue({ data: { context: {
      ...usage, usedTokens: 4500, outputTokens: 0,
      breakdown: { estimatedInputTokens: 4500, instructions: 4500, skills: 0, messages: 0, toolCalls: 0, toolDefinitions: 0 },
    } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.getByTestId('context-sector-instructions').tagName).toBe('circle')
    expect(screen.queryByTestId('context-sector-remaining')).not.toBeInTheDocument()
    expect(pieTrigger()).toHaveAccessibleName(/100% used/)
  })

  it('reports over-capacity usage without drawing negative free space', () => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, source: 'provider', usedTokens: 6000, outputTokens: 0 } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    expect(screen.queryByTestId('context-sector-remaining')).not.toBeInTheDocument()
    expect(pieTrigger()).toHaveAccessibleName(/133% used/)
    open()
    expect(screen.getByRole('dialog')).toHaveTextContent('Free context0')
    expect(screen.getByRole('dialog')).toHaveTextContent('Window used for next turn: 133%')
  })

  it.each(['Enter', ' '])('opens from the pie using the %p key without a mouse click', (key) => {
    mockedSWR.mockReturnValue({ data: { context: { ...usage, usedTokens: 1, outputTokens: 0 } } })
    render(<InstanceContextUsage instanceId="instance" siteId="site" />)
    const trigger = pieTrigger()
    act(() => { trigger.focus() })
    fireEvent.keyDown(trigger, { key })
    expect(screen.getByRole('dialog')).toHaveTextContent('Window used for next turn: <1%')
    expect(trigger).toHaveTextContent('')
  })
})
