/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postcss from 'postcss'

const readSource = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('floating chat input surface', () => {
  it('overrides legacy opaque composer backgrounds in both themes without touching textareas', () => {
    const css = postcss.parse(readSource('app/styles/chat-input-surface.css'))
    const selectors: string[] = []
    css.walkRules(rule => {
      selectors.push(...rule.selectors)
      rule.walkDecls(declaration => {
        expect(declaration.prop).toBe('background-color')
        expect(declaration.value).toBe('transparent')
        expect(declaration.important).toBe(true)
      })
    })
    expect(selectors).toEqual(['html .chat-input-container', 'html.dark .chat-input-container'])
    const layout = readSource('app/layout.tsx')
    expect(layout.indexOf('import "./styles/chat-input-surface.css"'))
      .toBeGreaterThan(layout.indexOf('import "./styles/dark-theme.css"'))
  })

  it('preserves the robot composer fade, empty-state positioning and transparent loading wrapper', () => {
    const robots = readSource('app/components/simple-messages-view/index.tsx')
    expect(robots).toContain('chat-input-container !bg-transparent')
    expect(robots).toContain('from-background via-background/90 to-transparent')
    expect(robots).toContain('isEmpty ? "opacity-0 h-32" : "opacity-100"')
    expect(readSource('app/components/skeletons/messages-skeleton.tsx'))
      .toContain('chat-input-container !bg-transparent !p-0')
  })
})