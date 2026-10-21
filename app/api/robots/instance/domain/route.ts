import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'

const inputSchema = z.object({
  siteId: z.string().uuid(),
  domain: z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i),
}).strict()

export async function POST(req: NextRequest) {
  try {
    const input = inputSchema.safeParse(await req.json())
    if (!input.success) return NextResponse.json({ error: 'Invalid domain or site' }, { status: 400 })
    const { domain, siteId } = input.data
    const access = await requireSiteAccess(req, siteId, { requireManager: true })
    if (access.error) return access.error

    // In a real environment, VERCEL_API_TOKEN and VERCEL_PROJECT_ID 
    // should be loaded securely in the environment variables.
    const vercelToken = process.env.VERCEL_API_TOKEN
    const projectId = process.env.VERCEL_PROJECT_ID
    const teamId = process.env.VERCEL_TEAM_ID

    if (!vercelToken || !projectId) {
      return NextResponse.json({ error: 'Vercel API credentials not configured' }, { status: 500 })
    }

    let url = `https://api.vercel.com/v10/projects/${projectId}/domains`
    if (teamId) {
      url += `?teamId=${teamId}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: domain })
    })

    const data = await response.json()

    if (!response.ok) {
      // Vercel returns 400 with 'domain_already_in_use' if it's already registered on the project
      if (data.error && data.error.code === 'domain_already_in_use') {
         return NextResponse.json({ success: true, message: 'Domain already exists in Vercel project' })
      }
      return NextResponse.json({ error: data.error?.message || 'Failed to add domain to Vercel' }, { status: response.status })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Vercel API add domain error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
