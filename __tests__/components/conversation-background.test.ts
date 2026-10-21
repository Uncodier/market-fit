/** @jest-environment node */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const readSource = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')
const robots = readSource('app/robots/robots-workspace.tsx')
const chat = readSource('app/chat/page.tsx')

describe('conversation background', () => {
  it('uses the dark page surface rather than a raised card for robot conversations', () => {
    expect(robots).toContain("isCanvasMode ? 'bg-transparent' : 'bg-background'")
    expect(robots).toContain("isCanvasMode ? 'bg-transparent overflow-visible' : 'bg-background overflow-hidden'")
    expect(robots).not.toContain("isCanvasMode ? 'bg-transparent overflow-visible' : 'bg-card overflow-hidden'")
  })

  it('keeps the separate browser preview on its existing card surface', () => {
    expect(robots).toContain('m-0 bg-card absolute inset-x-0 bottom-0')
  })

  it('sets an opaque page background for both the chat pane and its scroll area', () => {
    expect(chat).toContain('flex flex-col h-full bg-background transition-all')
    expect(chat).toContain('flex-1 overflow-y-auto bg-background min-w-0')
  })
})