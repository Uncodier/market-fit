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
    const brand = read('app/components/navigation/SidebarBrand.tsx')
    expect(sidebar).toContain('<SidebarBrand isCollapsed={renderCollapsed} />')
    expect(brand).toContain('text-black dark:text-white')
    expect(brand).toContain('src="/images/combination_mark.png"')
    expect(brand).toContain('object-contain dark:brightness-0 dark:invert')
    const svg = read('public/images/isotipo.svg')
    for (const path of svg.matchAll(/<path d="([^"]+)"/g)) {
      expect(brand).toContain(`d="${path[1]}"`)
    }
  })

  it('provides a padded SVG favicon and cache-versioned metadata', () => {
    const svg = read('public/favicon.svg')
    expect(svg).toContain('viewBox="-359.5 -256 2000 2000"')
    expect(svg).toContain('color="#fff"')
    expect(svg).toContain('<rect x="-359.5" y="-256" width="2000" height="2000" fill="#0a0a0c"/>')
    expect(svg.match(/fill="currentColor"/g)).toHaveLength(3)
    const layout = read('app/layout.tsx')
    expect(layout).toContain("url: '/favicon.svg?v=solid-mark-1', type: 'image/svg+xml'")
    expect(layout).toContain("url: '/favicon.ico?v=solid-mark-1'")
    expect(layout).toContain("url: '/apple-touch-icon.png?v=solid-mark-1', sizes: '180x180'")
  })

  it('keeps the legacy PNG URL with the current artwork for image previews', async () => {
    const png = sharp(path.join(process.cwd(), 'public/images/logo.png'))
    const metadata = await png.metadata()
    expect(metadata).toMatchObject({ format: 'png', width: 1080, height: 1080 })

    const artwork = await sharp(Buffer.from(read('public/images/isotipo.svg')))
      .resize(792, 792, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const pixels = await png.ensureAlpha().raw().toBuffer()
    expect([...pixels.subarray(4 * (540 * 1080 + 80), 4 * (540 * 1080 + 80) + 4)]).toEqual([23, 23, 23, 255])
    const left = Math.round((1080 - artwork.info.width) / 2)
    const top = Math.round((1080 - artwork.info.height) / 2)
    let matched = 0
    let visible = 0
    for (let y = 0; y < artwork.info.height; y++) {
      for (let x = 0; x < artwork.info.width; x++) {
        if (artwork.data[4 * (y * artwork.info.width + x) + 3] !== 255) continue
        const pixel = 4 * ((top + y) * 1080 + left + x)
        visible++
        if (pixels[pixel] === 255 && pixels[pixel + 1] === 255 && pixels[pixel + 2] === 255) matched++
      }
    }
    expect(matched / visible).toBeGreaterThan(0.99)
  })

  it('provides opaque ICO and Apple PNG fallbacks with a dark margin', async () => {
    const ico = readFileSync(path.join(process.cwd(), 'public/favicon.ico'))
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(ico.readUInt16LE(4)).toBe(3)
    for (let i = 0; i < 3; i++) {
      const entry = 6 + i * 16
      const offset = ico.readUInt32LE(entry + 12)
      const length = ico.readUInt32LE(entry + 8)
      await expectSolidMark(ico.subarray(offset, offset + length), [16, 32, 48][i], true)
    }
    await expectSolidMark(path.join(process.cwd(), 'public/apple-touch-icon.png'), 180)
  })
})

async function expectSolidMark(image: Buffer | string, size: number, hasAlpha = false) {
  const png = sharp(image)
  expect(await png.metadata()).toMatchObject({ format: 'png', width: size, height: size, hasAlpha })
  const pixels = await png.ensureAlpha().raw().toBuffer()
  for (const index of [0, size - 1, size * (size - 1), size * size - 1]) {
    expect([...pixels.subarray(index * 4, index * 4 + 4)]).toEqual([10, 10, 12, 255])
  }
  expect(pixels.every((channel, index) => index % 4 !== 3 || channel === 255)).toBe(true)
  expect(pixels.some((channel, index) => index % 4 === 0 && channel > 225)).toBe(true)
}