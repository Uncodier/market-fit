import { NextRequest, NextResponse } from 'next/server'
import { getAuthInfo } from '@/app/context/auth-context-server'

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthInfo()
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { domain, siteId } = body

    if (!domain) {
      return NextResponse.json({ error: 'Missing required parameters (domain)' }, { status: 400 })
    }

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
  } catch (error: any) {
    console.error('Vercel API add domain error:', error)
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 })
  }
}
