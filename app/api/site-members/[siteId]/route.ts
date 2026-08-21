import { NextResponse } from "next/server"
import { isAdminScreenRole, parseWritableSiteMemberRole, sanitizeBlockedScreens } from "@/lib/auth/screen-access"
import {
  createServiceSupabase,
  denyUnlessTeamManager,
  getSiteMemberAccess,
} from "@/lib/auth/site-member-request"

function invalidSiteResponse() {
  return NextResponse.json({ success: false, error: "Invalid site" }, { status: 400 })
}

async function withSiteOwner(
  admin: ReturnType<typeof createServiceSupabase>,
  siteId: string,
  ownerUserId: string,
  members: any[]
) {
  if (members.some((member) => member.user_id === ownerUserId)) return members

  const { data: authUser } = await admin.auth.admin.getUserById(ownerUserId)
  const { data: profile } = await admin
    .from("profiles")
    .select("name, email")
    .eq("id", ownerUserId)
    .maybeSingle()
  const email = profile?.email || authUser?.email
  if (!email) return members

    const { data: inserted, error } = await admin
    .from("site_members")
    .insert({
      site_id: siteId,
      user_id: ownerUserId,
      email,
      name: profile?.name || authUser?.user_metadata?.name || null,
      role: "owner",
      status: "active",
      blocked_screens: [],
      restrict_to_assigned_only: false,
    })
    .select()
    .single()

  if (error || !inserted) {
    const { data: refreshed } = await admin.from("site_members").select("*").eq("site_id", siteId)
    return refreshed || members
  }
  return [inserted, ...members]
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params

    if (siteId && siteId.startsWith("demo-")) {
      return NextResponse.json({ success: true, members: [] })
    }

    const access = await getSiteMemberAccess(siteId)
    if (access.error) return access.error

    const { isOwner, isMember, ownerUserId } = access

    if (!isOwner && !isMember) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to view site members" },
        { status: 403 }
      )
    }

    const adminSupabase = createServiceSupabase()
    const { data: listedMembers, error: membersError } = await adminSupabase
      .from("site_members")
      .select("*")
      .eq("site_id", siteId)
      .order("role", { ascending: false })

    if (membersError) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch site members" },
        { status: 500 }
      )
    }

    const siteMembers = await withSiteOwner(
      adminSupabase,
      siteId,
      ownerUserId,
      listedMembers || []
    )

    const membersWithStatus = await Promise.all(
      (siteMembers || []).map(async (member: any) => {
        if (!member.user_id) {
          return {
            ...member,
            blocked_screens: member.blocked_screens || [],
            restrict_to_assigned_only: member.restrict_to_assigned_only || false,
            emailConfirmed: false,
            lastSignIn: null,
          }
        }

        try {
          const {
            data: { user: authUser },
            error: authError,
          } = await adminSupabase.auth.admin.getUserById(member.user_id)

          if (authError || !authUser) {
            console.warn(`Could not fetch user info for user_id ${member.user_id}:`, authError)
            return {
              ...member,
              blocked_screens: member.blocked_screens || [],
              emailConfirmed: false,
              lastSignIn: null,
            }
          }

          let actualStatus = member.status
          if (member.status === "active" && !authUser.last_sign_in_at) {
            actualStatus = "pending"
          }

          return {
            ...member,
            blocked_screens: member.blocked_screens || [],
            restrict_to_assigned_only: member.restrict_to_assigned_only || false,
            emailConfirmed: !!authUser.email_confirmed_at,
            lastSignIn: authUser.last_sign_in_at,
            status: actualStatus,
          }
        } catch (err) {
          console.warn(`Error fetching user status for ${member.email}:`, err)
          return {
            ...member,
            blocked_screens: member.blocked_screens || [],
            restrict_to_assigned_only: member.restrict_to_assigned_only || false,
            emailConfirmed: false,
            lastSignIn: null,
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      members: membersWithStatus,
    })
  } catch (error) {
    console.error("Error fetching site members:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    if (!siteId || siteId.startsWith("demo-")) return invalidSiteResponse()

    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied
    if (access.error) return access.error

    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const role = parseWritableSiteMemberRole(body.role)
    if (!email) {
      return NextResponse.json({ success: false, error: "email is required" }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: "A valid email is required" }, { status: 400 })
    }
    if (!role) {
      return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 })
    }

    const adminSupabase = createServiceSupabase()
    const { data: existing } = await adminSupabase
      .from("site_members")
      .select("id")
      .eq("site_id", siteId)
      .eq("email", email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: "This email is already a member of this site" },
        { status: 409 }
      )
    }

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle()

    const blockedScreens = role === "admin" ? [] : sanitizeBlockedScreens(body.blocked_screens)
    const { data: inserted, error: insertError } = await adminSupabase
      .from("site_members")
      .insert({
        site_id: siteId,
        user_id: profile?.id || null,
        email,
        role,
        name: typeof body.name === "string" ? body.name : null,
        position: typeof body.position === "string" ? body.position : null,
        blocked_screens: blockedScreens,
        restrict_to_assigned_only: typeof body.restrict_to_assigned_only === "boolean" ? body.restrict_to_assigned_only : false,
        added_by: access.userId,
        status: profile?.id ? "active" : "pending",
      })
      .select()
      .single()

    if (insertError || !inserted) {
      if (insertError?.code === "23505") {
        return NextResponse.json(
          { success: false, error: "This email is already a member of this site" },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { success: false, error: insertError?.message || "Failed to add site member" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      member: { ...inserted, blocked_screens: inserted.blocked_screens || [] },
    })
  } catch (error) {
    console.error("Error adding site member:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    if (!siteId || siteId.startsWith("demo-")) return invalidSiteResponse()

    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied

    const body = await request.json().catch(() => ({}))
    const memberId = typeof body.memberId === "string" ? body.memberId : ""
    if (!memberId) {
      return NextResponse.json({ success: false, error: "memberId is required" }, { status: 400 })
    }

    const adminSupabase = createServiceSupabase()
    const { data: target, error: targetError } = await adminSupabase
      .from("site_members")
      .select("id, role, site_id")
      .eq("id", memberId)
      .eq("site_id", siteId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 })
    }

    if (target.role === "owner") {
      return NextResponse.json(
        { success: false, error: "Cannot change the site owner from team settings" },
        { status: 400 }
      )
    }

    const patch: Record<string, unknown> = {}
    const nextRole = parseWritableSiteMemberRole(body.role)
    if (nextRole) {
      patch.role = nextRole
    }

    if ("name" in body) {
      patch.name = typeof body.name === "string" ? body.name : null
    }
    if ("position" in body) {
      patch.position = typeof body.position === "string" ? body.position : null
    }
    if ("restrict_to_assigned_only" in body) {
      patch.restrict_to_assigned_only = typeof body.restrict_to_assigned_only === "boolean" ? body.restrict_to_assigned_only : false
    }

    const effectiveRole = nextRole || target.role
    if ("blocked_screens" in body || nextRole === "admin") {
      patch.blocked_screens = isAdminScreenRole(effectiveRole)
        ? []
        : sanitizeBlockedScreens(body.blocked_screens)
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: false, error: "No updates provided" }, { status: 400 })
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from("site_members")
      .update(patch)
      .eq("id", memberId)
      .eq("site_id", siteId)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to update member" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      member: { ...updated, blocked_screens: updated.blocked_screens || [] },
    })
  } catch (error) {
    console.error("Error updating site member:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params
    if (!siteId || siteId.startsWith("demo-")) return invalidSiteResponse()

    const access = await getSiteMemberAccess(siteId)
    const denied = denyUnlessTeamManager(access)
    if (denied) return denied

    const memberId = new URL(request.url).searchParams.get("memberId") || ""
    if (!memberId) {
      return NextResponse.json({ success: false, error: "memberId is required" }, { status: 400 })
    }

    const adminSupabase = createServiceSupabase()
    const { data: target, error: targetError } = await adminSupabase
      .from("site_members")
      .select("id, role")
      .eq("id", memberId)
      .eq("site_id", siteId)
      .single()

    if (targetError || !target) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 })
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { success: false, error: "Cannot remove the site owner" },
        { status: 400 }
      )
    }

    const { error: deleteError } = await adminSupabase
      .from("site_members")
      .delete()
      .eq("id", memberId)
      .eq("site_id", siteId)

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message || "Failed to remove member" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing site member:", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
