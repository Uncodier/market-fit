/** @jest-environment node */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import postcss, { type Rule } from 'postcss'
import tailwindcss from 'tailwindcss'
import colors from 'tailwindcss/colors'
import config from '../../tailwind.config'

const readSource = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')
const themeSource = readSource('app/styles/dark-theme.css')
const theme = postcss.parse(themeSource)
const globals = postcss.parse(readSource('app/globals.css'))
const configuredColors = config.theme?.extend?.colors as Record<string, string | Record<string, string>>

function declarations(root: postcss.Root, selector: string) {
  const values: Record<string, string> = {}
  root.walkRules((rule: Rule) => {
    if (!rule.selectors.includes(selector)) return
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
  })
  return values
}

describe('home-inspired dark theme', () => {
  it('maps the home palette onto shared semantic surfaces', () => {
    expect(declarations(theme, 'html.dark')).toMatchObject({
      '--background': '120 6.122449% 9.607843%',
      '--foreground': '68.571429 16.27907% 91.568627%',
      '--card': '110 8.823529% 13.333333%',
      '--popover': '92.727273 13.253012% 16.27451%',
      '--muted-foreground': '88 8.571429% 65.686275%',
      '--border': '96.923077 11.111111% 23.333333%',
      '--input': 'var(--border)',
      '--accent': '90 20.454545% 17.254902%',
    })
  })

  it('only applies overrides when the document is dark', () => {
    theme.walkRules(rule => {
      for (const selector of rule.selectors) expect(selector).toMatch(/^html\.dark(?:\s|$)/)
    })
    const layout = readSource('app/layout.tsx')
    expect(layout.indexOf('import "./styles/dark-theme.css"'))
      .toBeGreaterThan(layout.indexOf('import "./globals.css"'))
    expect(declarations(globals, ':root')['--background']).toBe('0 0% 100%')
    expect(readSource('app/components/EarlyBrowserInit.tsx'))
      .toContain('document.documentElement.style.background = "hsl(var(--background))"')
  })

  it('does not override the brand green, primary buttons or semantic status colors', () => {
    expect(configuredColors).toMatchObject({
      'primary-button': '#90ff17',
      'primary-button-hover': '#ffdc24',
      'primary-button-border': '#57921799',
    })
    expect(declarations(globals, 'html.dark')).toMatchObject({
      '--primary': '0 0% 100%',
      '--primary-foreground': '222.2 84% 4.9%',
    })
    theme.walkDecls(declaration => {
      expect(declaration.prop).not.toMatch(/^--(?:primary|btn-|destructive)/)
    })
    theme.walkRules(rule => { expect(rule.selector).not.toMatch(/btn-primary|\.bg-primary/) })
    expect(declarations(globals, '.btn-primary')['--btn-fill']).toBe('6 6 8')
    expect(declarations(globals, '.dark .btn-primary')['--btn-fill']).toBe('42 36 56')
  })

  it('uses valid HSL colors for legacy chat surfaces and inputs', () => {
    expect(declarations(theme, 'html.dark .chat-input-container')['background-color'])
      .toBeUndefined()
    theme.walkDecls(/^(?:background-color|color|border-color)$/, declaration => {
      expect(declaration.value).not.toMatch(/^var\(--(?:background|foreground)\)$/)
    })
    expect(themeSource).toContain('background-color: hsl(var(--card) / 0.75) !important')
    expect(themeSource).toContain('border-color: hsl(var(--ring)) !important')
  })

  it('compiles neutral utilities with original light fallbacks and working opacity', async () => {
    const result = await postcss([tailwindcss({
      ...config,
      content: [{ raw: 'bg-gray-900 dark:bg-gray-900/50 text-slate-400 border-zinc-800 bg-neutral-950', extension: 'html' }],
    })]).process('@tailwind utilities;', { from: undefined })

    expect(result.css).toContain('var(--theme-neutral-900, 17 24 39) / 0.5')
    expect(result.css).toContain('var(--theme-neutral-400, 148 163 184)')
    expect(result.css).toContain('var(--theme-neutral-800, 39 39 42)')
    expect(result.css).toContain('var(--theme-neutral-950, 10 10 10)')
    for (const palette of ['gray', 'slate', 'zinc', 'neutral'] as const) {
      for (const [shade, hex] of Object.entries(colors[palette])) {
        const channels = hex.slice(1).match(/.{2}/g)!.map(channel => parseInt(channel, 16)).join(' ')
        expect((configuredColors[palette] as Record<string, string>)[shade])
          .toBe(`rgb(var(--theme-neutral-${shade}, ${channels}) / <alpha-value>)`)
      }
    }
  })
})