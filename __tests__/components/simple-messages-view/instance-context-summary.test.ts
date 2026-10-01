import { getContextUsageSummary, type ContextUsage } from '@/app/components/simple-messages-view/utils/instance-context-usage'

const usage: ContextUsage = {
  model: 'configured', usedTokens: 1000, outputTokens: 250,
  availableTokens: 5000, reservedOutputTokens: 500, source: 'estimate',
  breakdown: {
    estimatedInputTokens: 1000, instructions: 200, skills: 100,
    messages: 300, toolCalls: 150, toolDefinitions: 250,
  },
}

describe('unified instance context pie data', () => {
  it('uses the input budget for both category slices and free space, including the last output once', () => {
    const summary = getContextUsageSummary(usage)
    expect(summary).toMatchObject({ budget: 4500, projected: 1250, remaining: 3250, percentage: '28%' })
    expect(summary.sectors.map(({ key }) => key)).toEqual([
      'instructions', 'skills', 'messages', 'toolCalls', 'toolDefinitions', 'output', 'remaining',
    ])
    expect(summary.sectors.find(({ key }) => key === 'instructions')?.share).toBeCloseTo(200 / 4500)
    expect(summary.sectors.find(({ key }) => key === 'output')?.share).toBeCloseTo(250 / 4500)
    expect(summary.sectors.find(({ key }) => key === 'remaining')?.share).toBeCloseTo(3250 / 4500)
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it('renders the reported example as about 6% used instead of a fully occupied category pie', () => {
    const summary = getContextUsageSummary({
      ...usage, usedTokens: 62637, outputTokens: null, availableTokens: 1048576, reservedOutputTokens: 0,
      breakdown: {
        estimatedInputTokens: 62637, instructions: 25262, skills: 0,
        messages: 7671, toolCalls: 0, toolDefinitions: 29704,
      },
    })
    expect(summary.percentage).toBe('6%')
    expect(summary.remaining).toBe(985939)
    expect(summary.sectors.map(({ key }) => key)).toEqual(['instructions', 'messages', 'toolDefinitions', 'remaining'])
    expect(summary.sectors.find(({ key }) => key === 'remaining')?.share).toBeCloseTo(985939 / 1048576)
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it.each([800, 1200])('scales estimated category proportions to provider input of %i tokens', (usedTokens) => {
    const summary = getContextUsageSummary({ ...usage, source: 'provider', usedTokens })
    expect(summary.sectors.find(({ key }) => key === 'instructions')?.share).toBeCloseTo((usedTokens * 0.2) / 4500)
    expect(summary.remaining).toBe(4500 - usedTokens - 250)
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it.each([null, 0, 500])('does not claim free space when capacity %p has no verified input budget', (availableTokens) => {
    const summary = getContextUsageSummary({ ...usage, availableTokens })
    expect(summary).toMatchObject({ budget: null, remaining: null, utilization: null, percentage: null })
    expect(summary.sectors.find(({ key }) => key === 'remaining')).toBeUndefined()
    expect(summary.sectors.find(({ key }) => key === 'instructions')?.share).toBeCloseTo(200 / 1250)
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it.each([null, undefined, 0])('omits an output slice for %p without adding fictional tokens', (outputTokens) => {
    const summary = getContextUsageSummary({ ...usage, outputTokens })
    expect(summary.projected).toBe(1000)
    expect(summary.remaining).toBe(3500)
    expect(summary.sectors.find(({ key }) => key === 'output')).toBeUndefined()
  })

  it('retains known input and output when category breakdown is missing', () => {
    const summary = getContextUsageSummary({ ...usage, breakdown: null })
    expect(summary.sectors.map(({ key }) => key)).toEqual(['input', 'output', 'remaining'])
    expect(summary.sectors[0].share).toBeCloseTo(1000 / 4500)
  })

  it('does not divide by zero when a provider reports input but all category estimates are zero', () => {
    const summary = getContextUsageSummary({
      ...usage, source: 'provider', breakdown: {
        estimatedInputTokens: 0, instructions: 0, skills: 0, messages: 0, toolCalls: 0, toolDefinitions: 0,
      },
    })
    expect(summary.sectors.map(({ key }) => key)).toEqual(['input', 'output', 'remaining'])
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it('renders an empty known context as entirely free', () => {
    const summary = getContextUsageSummary({ ...usage, usedTokens: 0, outputTokens: 0, breakdown: null })
    expect(summary.percentage).toBe('0%')
    expect(summary.sectors).toEqual([{ key: 'remaining', share: 1 }])
  })

  it.each([null, undefined])('does not claim any slices or capacity without a measurement (%p)', (context) => {
    expect(getContextUsageSummary(context)).toMatchObject({
      sectors: [], budget: null, remaining: null, percentage: null,
    })
  })

  it.each([4500, 6000])('fits a full or over-capacity context of %i tokens into one pie without negative free space', (usedTokens) => {
    const summary = getContextUsageSummary({ ...usage, source: 'provider', usedTokens, outputTokens: 0 })
    expect(summary.remaining).toBe(0)
    expect(summary.percentage).toBe(usedTokens === 4500 ? '100%' : '133%')
    expect(summary.sectors.find(({ key }) => key === 'remaining')).toBeUndefined()
    expect(summary.sectors.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1)
  })

  it('keeps tiny positive utilization distinct from zero', () => {
    const summary = getContextUsageSummary({ ...usage, usedTokens: 1, outputTokens: 0, breakdown: null })
    expect(summary.percentage).toBe('<1%')
    expect(summary.sectors.find(({ key }) => key === 'input')?.share).toBeCloseTo(1 / 4500)
  })
})