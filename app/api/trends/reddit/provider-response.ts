import { z } from 'zod'

export class RedditProviderError extends Error {
  constructor(readonly phase: 'authorization' | 'listing', readonly kind: 'transport' | 'http' | 'payload', readonly status?: number) {
    super('Reddit provider request failed')
    this.name = 'RedditProviderError'
  }
}

const postSchema = z.object({
  title: z.string(), score: z.number().finite(), num_comments: z.number().int().nonnegative(),
  created_utc: z.number().finite(), subreddit: z.string(), permalink: z.string(), url: z.string(),
  selftext: z.string().optional(),
})
const listingSchema = z.object({ data: z.object({ children: z.array(z.object({ data: postSchema })) }) })
const tokenSchema = z.object({ access_token: z.string().min(1).max(8192).regex(/^\S+$/),
  expires_in: z.number().finite().nonnegative().optional() })

/** Provider failures never become client validation errors or successful empty data. */
async function providerJson(url: string, options: RequestInit, phase: 'authorization' | 'listing'): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10_000) })
  } catch { throw new RedditProviderError(phase, 'transport') }
  if (!response.ok) {
    void response.body?.cancel().catch(() => {})
    throw new RedditProviderError(phase, 'http', response.status)
  }
  try { return await response.json() }
  catch { throw new RedditProviderError(phase, 'payload') }
}

export async function readRedditListing(url: string, headers: Record<string, string>) {
  const parsed = listingSchema.safeParse(await providerJson(url, { headers }, 'listing'))
  if (!parsed.success) throw new RedditProviderError('listing', 'payload')
  return parsed.data
}

export async function requestRedditAccessToken(clientId: string, clientSecret: string, userAgent: string) {
  const parsed = tokenSchema.safeParse(await providerJson('https://www.reddit.com/api/v1/access_token', {
    method: 'POST', headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': userAgent,
    }, body: 'grant_type=client_credentials',
  }, 'authorization'))
  if (!parsed.success) throw new RedditProviderError('authorization', 'payload')
  return parsed.data
}