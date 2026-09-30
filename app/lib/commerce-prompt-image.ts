import 'server-only'
import sharp from 'sharp'
import { normalizePromptImageUrl } from './prompt-image-url'
import { IMAGE_PLACEHOLDER_SVG } from './image-placeholder'
import { parsePromptImageInput } from '@/lib/images/prompt-image-contract'
import { readPromptImageCache } from '@/lib/images/prompt-image-cache'

/** Crawlers have no workspace session. Serve existing public bytes, never paid generation. */
export async function resolveCommercePromptImage(url: string, size: { width: number; height: number }): Promise<string> {
  const normalized = new URL(normalizePromptImageUrl(url), 'https://image.invalid')
  const input = parsePromptImageInput(normalized.searchParams)
  const cached = input ? await readPromptImageCache(input, input.site_id) : null
  const bytes = cached ? Buffer.from(cached.bytes) : Buffer.from(IMAGE_PLACEHOLDER_SVG)
  try {
    const png = await sharp(bytes, { limitInputPixels: 24_000_000 })
      .resize(size.width, size.height, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    const png = await sharp(Buffer.from(IMAGE_PLACEHOLDER_SVG)).png().toBuffer()
    return `data:image/png;base64,${png.toString('base64')}`
  }
}