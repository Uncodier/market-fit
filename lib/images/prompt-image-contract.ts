import { z } from 'zod'

const dimension = z.coerce.number().int().min(1).max(1600).default(1024)
const schema = z.object({
  prompt: z.string().trim().min(1).max(2000).refine(value => value !== '.' && value !== '..' && !/[\u0000-\u001f\u007f]/.test(value)),
  width: dimension,
  height: dimension,
  site_id: z.string().uuid().optional(),
  cache_only: z.literal('1').optional(),
})
export type PromptImageInput = z.infer<typeof schema>

export function parsePromptImageInput(params: URLSearchParams): PromptImageInput | null {
  const keys = ['prompt', 'width', 'height', 'site_id', 'cache_only']
  if (Array.from(params.keys()).some(key => !keys.includes(key) || params.getAll(key).length !== 1)) return null
  const result = schema.safeParse(Object.fromEntries(params))
  return result.success ? result.data : null
}