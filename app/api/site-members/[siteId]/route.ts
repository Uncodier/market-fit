import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params

    // Create client for user authentication using SSR
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Check if current user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Verify user has permission to access this site
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .select('name, user_id')
      .eq('id', siteId)
      .single()
    
    if (siteError || !siteData) {
      return NextResponse.json(
        { success: false, error: 'Site not found or access denied' },
        { status: 404 }
      )
    }

    const { data: membershipCheck } = await supabase
      .from('site_members')
      .select('role')
      .eq('site_id', siteId)
      .eq('user_id', user.id)
      .single()

    const isOwner = siteData.user_id === user.id
    const isMember = !!membershipCheck
    
    if (!isOwner && !isMember) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions to view site members' },
        { status: 403 }
      )
    }

    // Get site members
    const { data: siteMembers, error: membersError } = await supabase
      .from('site_members')
      .select('*')
      .eq('site_id', siteId)
      .order('role', { ascending: false })
    
    if (membersError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch site members' },
        { status: 500 }
      )
    }

    // Create admin client to get user auth status
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // For each member, get their email confirmation status from auth.users using admin client
    const membersWithStatus = await Promise.all((siteMembers || []).map(async (member: any) => {
      if (!member.user_id) {
        // User hasn't been created yet, so email is not confirmed
        return {
          ...member,
          emailConfirmed: false,
          lastSignIn: null
        }
      }
      
      try {
        // Get user info from auth.users via admin API
        const { data: { user: authUser }, error: authError } = await adminSupabase.auth.admin.getUserById(member.user_id)
        
        if (authError || !authUser) {
          console.warn(`Could not fetch user info for user_id ${member.user_id}:`, authError)
          return {
            ...member,
            emailConfirmed: false,
            lastSignIn: null
          }
        }
        
        // Determine the correct status based on email confirmation and sign-in history
        let actualStatus = member.status;
        if (member.status === 'active') {
          // If marked as active, verify they've actually signed in
          if (!authUser.last_sign_in_at) {
            actualStatus = 'pending'; // User exists but never signed in
          }
        }
        
        return {
          ...member,
          emailConfirmed: !!authUser.email_confirmed_at,
          lastSignIn: authUser.last_sign_in_at,
          status: actualStatus // Override status based on actual sign-in history
        }
      } catch (err) {
        console.warn(`Error fetching user status for ${member.email}:`, err)
        return {
          ...member,
          emailConfirmed: false,
          lastSignIn: null
        }
      }
    }))

    return NextResponse.json({
      success: true,
      members: membersWithStatus
    })

  } catch (error) {
    console.error('Error fetching site members:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
} 