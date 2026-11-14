import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const viewSource = readFileSync(
  join(process.cwd(), 'app/components/simple-messages-view/index.tsx'),
  'utf8',
)

describe('new agent empty state', () => {
  it('does not render a greeting or subtitle above the composer', () => {
    expect(viewSource).not.toContain('EmptyStateWelcome')
    expect(viewSource).not.toContain('Start with a goal, question, or task.')
    expect(viewSource).toContain('<MessageInput')
    expect(viewSource).toContain('<EmptyStatePrompts')
  })

  it('centers the empty composer and suggestions without moving the active chat input', () => {
    expect(viewSource).toContain(
      '"top-[calc(var(--topbar-height,64px)+71px)] pb-[calc(var(--topbar-height,64px)+23px)]"',
    )
    expect(viewSource).toContain('"top-auto justify-end pb-[15px]"')
    expect(viewSource).toContain(
      'isEmpty ? "flex flex-col gap-3" : "flex flex-col w-full gap-2"',
    )
    expect(viewSource).toContain('placeholderSuggestions={isEmpty ? EMPTY_STATE_TYPEWRITER_PROMPTS : undefined}')
  })

  it('omits the fixed-header inset when the mobile toolbar is outside the conversation', () => {
    expect(viewSource).toContain('cn("justify-center", hasTopHeaderSpace')
    expect(viewSource).toContain('"top-0 pb-12 lg:top-[calc(var(--topbar-height,64px)+71px)] lg:pb-[calc(var(--topbar-height,64px)+23px)]"')
  })
})
