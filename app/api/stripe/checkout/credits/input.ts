import { z } from 'zod'

const returnUrl = z.string().min(1).max(2048).url().refine(value => {
  try {
    const url = new URL(value)
    return !url.username && !url.password
  } catch {
    return false
  }
})

export const creditsCheckoutInput = z.object({
  siteId: z.string().uuid(),
  credits: z.number().int().positive().safe(),
  amount: z.number().finite().positive(),
  successUrl: returnUrl.optional(),
  cancelUrl: returnUrl,
})