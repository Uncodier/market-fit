/** @jest-environment node */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

describe('Makinari isotipo', () => {
  it('preserves the original proportions and white artwork', () => {
    const svg = read('public/images/isotipo.svg')
    expect(svg).toContain('viewBox="0 0 1281 1488"')
    expect(svg.match(/fill="white"/g)).toHaveLength(3)
  })

  it('uses the new mark only in the collapsed sidebar with both theme treatments', () => {
    const sidebar = read('app/components/navigation/Sidebar.tsx')
    expect(sidebar).toContain('renderCollapsed ? "/images/isotipo.svg" : "/images/combination_mark.png"')
    expect(sidebar).toContain('renderCollapsed ? "brightness-0 dark:invert"')
    expect(sidebar).toContain('object-contain')
  })

  it('provides a white transparent SVG favicon and cache-versioned metadata', () => {
    const svg = read('public/favicon.svg')
    expect(svg).toContain('svg { color: #fff; }')
    expect(svg).not.toContain('#000')
    expect(svg).not.toContain('<rect')
    expect(svg.match(/fill="currentColor"/g)).toHaveLength(3)
    const layout = read('app/layout.tsx')
    expect(layout).toContain("url: '/favicon.svg?v=white-transparent-2', type: 'image/svg+xml'")
    expect(layout).toContain("url: '/favicon.ico?v=white-transparent-2'")
  })

  it('provides valid multi-size ICO and Apple PNG fallbacks', async () => {
    const ico = readFileSync(path.join(process.cwd(), 'public/favicon.ico'))
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(3)
    for (let i = 0; i < 3; i++) {
      const entry = 6 + i * 16
      const offset = ico.readUInt32LE(entry + 12)
      const length = ico.readUInt32LE(entry + 8)
      const metadata = await sharp(ico.subarray(offset, offset + length)).metadata()
      expect(metadata.width).toBe([16, 32, 48][i])
      expect(metadata.height).toBe(metadata.width)
      expect(metadata.hasAlpha).toBe(true)
      const pixels = await sharp(ico.subarray(offset, offset + length)).ensureAlpha().raw().toBuffer()
      let transparent = 0
      let visible = 0
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        if (pixels[pixel + 3] === 0) {
          transparent++
        } else {
          visible++
          expect([...pixels.subarray(pixel, pixel + 3)]).toEqual([255, 255, 255])
        }
      }
      expect(transparent).toBeGreaterThan(0)
      expect(visible).toBeGreaterThan(0)
    }
    const apple = await sharp(path.join(process.cwd(), 'public/apple-touch-icon.png')).metadata()
    expect(apple.width).toBe(180)
    expect(apple.height).toBe(180)
  })
})