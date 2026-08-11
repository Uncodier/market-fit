"use server"

import { revalidatePath } from "next/cache"
import type { Reservation, ReservationChannel, ReservationResourceType, VisitsSettings } from "@/app/types"
import {
  assertVisitAttestation,
  buildVisitResourcePayload,
  mergeVisitsSettings,
  resolveVisitTermsText,
} from "./visit-helpers"
import {
  consumeVisitEntitlement,
  requireSiteMember,
  requireVisitUser,
  uploadAttestation,
  validateVisitResource,
} from "./visit-server"

export async function getVisitsSettings(siteId: string) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { error: auth.error || "Not logged in", data: mergeVisitsSettings() }

    const { data, error } = await auth.supabase.from("settings").select("visits").eq("site_id", siteId).maybeSingle()
    if (error) return { error: error.message, data: mergeVisitsSettings() }
    return { data: mergeVisitsSettings(data?.visits as Partial<VisitsSettings> | null) }
  } catch (e: any) {
    return { error: e.message, data: mergeVisitsSettings() }
  }
}

export async function updateVisitsSettings(siteId: string, patch: Partial<VisitsSettings>) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { error: auth.error || "Not logged in" }

    const member = await requireSiteMember(auth.supabase, siteId, auth.user.id)
    if (member.error) return { error: member.error }

    const { data: current } = await auth.supabase.from("settings").select("visits").eq("site_id", siteId).maybeSingle()
    const merged = mergeVisitsSettings({
      ...(current?.visits as Partial<VisitsSettings> | null),
      ...patch,
    })

    const { data: existing } = await auth.supabase
      .from("settings")
      .select("site_id")
      .eq("site_id", siteId)
      .maybeSingle()

    const { error } = existing
      ? await auth.supabase
          .from("settings")
          .update({ visits: merged, updated_at: new Date().toISOString() })
          .eq("site_id", siteId)
      : await auth.supabase.from("settings").insert({ site_id: siteId, visits: merged })

    if (error) return { error: error.message }

    revalidatePath("/visits")
    return { data: merged }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function listVisits(siteId: string) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { data: [], error: auth.error || "Not logged in" }

    const { data, error } = await auth.supabase
      .from("reservations")
      .select(
        `
        *,
        catalog_item:catalog_items(id, name, kind),
        location:locations(id, name),
        lead:leads(id, name, email, buyer_user_id)
      `
      )
      .eq("site_id", siteId)
      .eq("status", "completed")
      .order("start_time", { ascending: false })
      .limit(200)

    if (error) return { data: [], error: error.message }
    return { data: (data || []) as Reservation[] }
  } catch (e: any) {
    return { data: [], error: e.message }
  }
}

export async function listVisitEmployees(siteId: string) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { data: [], error: auth.error || "Not logged in" }

    const { data: memberRows } = await auth.supabase
      .from("site_members")
      .select("user_id, name, email")
      .eq("site_id", siteId)
      .eq("status", "active")
      .not("user_id", "is", null)

    const { data: site } = await auth.supabase.from("sites").select("user_id").eq("id", siteId).maybeSingle()

    const userIds = new Set<string>()
    const nameHints = new Map<string, string>()
    for (const row of memberRows || []) {
      if (row.user_id) {
        userIds.add(row.user_id)
        if (row.name) nameHints.set(row.user_id, row.name)
        else if (row.email) nameHints.set(row.user_id, row.email)
      }
    }
    if (site?.user_id) userIds.add(site.user_id)
    if (userIds.size === 0) return { data: [] }

    const { data: profiles } = await auth.supabase
      .from("profiles")
      .select("id, name")
      .in("id", Array.from(userIds))

    const nameById = new Map((profiles || []).map((p) => [p.id, p.name || "Unknown"]))

    return {
      data: Array.from(userIds).map((id) => ({
        id,
        name: nameById.get(id) || nameHints.get(id) || "Unknown",
      })),
    }
  } catch (e: any) {
    return { data: [], error: e.message }
  }
}

export async function listLeadActivePasses(siteId: string, leadId: string) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { data: [], error: auth.error || "Not logged in" }

    const { data: lead } = await auth.supabase
      .from("leads")
      .select("id, buyer_user_id")
      .eq("id", leadId)
      .eq("site_id", siteId)
      .maybeSingle()

    if (!lead?.buyer_user_id) return { data: [] }

    const { data, error } = await auth.supabase
      .from("entitlements")
      .select("id, status, uses_remaining, expires_at, catalog_item_id, catalog_item:catalog_items(id, name, kind, digital_subtype)")
      .eq("site_id", siteId)
      .eq("buyer_user_id", lead.buyer_user_id)
      .eq("status", "active")

    if (error) return { data: [], error: error.message }

    const passes = (data || []).filter((e: any) => {
      const item = e.catalog_item
      return item?.kind === "digital_asset" && item?.digital_subtype === "pass"
    })

    return { data: passes }
  } catch (e: any) {
    return { data: [], error: e.message }
  }
}

export type RegisterVisitInput = {
  siteId: string
  /** Optional when visitor identity fields are provided (physical kiosk). */
  leadId?: string
  visitorName?: string | null
  visitorEmail?: string | null
  visitorPhone?: string | null
  resourceType: ReservationResourceType
  catalogItemId?: string | null
  locationId?: string | null
  assigneeUserId?: string | null
  entitlementId?: string | null
  notes?: string | null
  durationMinutes?: number | null
  termsAccepted: boolean
  /** Terms text shown to the visitor (localized default or custom). Stored as snapshot. */
  acceptedTermsText?: string | null
  signatureDataUrl?: string | null
  photoDataUrl?: string | null
  idDataUrl?: string | null
  channel?: ReservationChannel
}

async function resolveVisitLead(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  input: RegisterVisitInput,
  opts: { asBuyer: boolean; userId: string }
) {
  if (input.leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id, buyer_user_id, site_id")
      .eq("id", input.leadId)
      .eq("site_id", input.siteId)
      .maybeSingle()
    if (!lead) return { error: "Customer not found" }
    if (opts.asBuyer && lead.buyer_user_id !== opts.userId) {
      return { error: "Not authorized for this customer" }
    }
    return { lead }
  }

  const name = input.visitorName?.trim()
  if (!name) return { error: "Your name is required" }

  const email = input.visitorEmail?.trim().toLowerCase() || null
  const phone = input.visitorPhone?.trim() || null

  if (email) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id, buyer_user_id, site_id")
      .eq("site_id", input.siteId)
      .ilike("email", email)
      .maybeSingle()
    if (existing) {
      await supabase
        .from("leads")
        .update({
          name,
          phone: phone || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
      return { lead: existing }
    }
  }

  const { data: created, error: createError } = await supabase
    .from("leads")
    .insert({
      site_id: input.siteId,
      name,
      email,
      phone,
      status: "new",
      origin: "visit_registration",
    })
    .select("id, buyer_user_id, site_id")
    .single()

  if (createError || !created) return { error: createError?.message || "Could not create visitor record" }
  return { lead: created }
}

async function registerVisitCore(input: RegisterVisitInput, opts: { asBuyer: boolean }) {
  const auth = await requireVisitUser()
  if (auth.error || !auth.user) return { error: auth.error || "Not logged in" }

  const channel: ReservationChannel = input.channel || (opts.asBuyer ? "online" : "physical")

  if (!opts.asBuyer) {
    const member = await requireSiteMember(auth.supabase, input.siteId, auth.user.id)
    if (member.error) return { error: member.error }
  }

  const settingsRes = await getVisitsSettings(input.siteId)
  const settings = settingsRes.data

  const attestationError = assertVisitAttestation({
    settings,
    channel,
    termsAccepted: input.termsAccepted,
    signatureDataUrl: input.signatureDataUrl,
    photoDataUrl: input.photoDataUrl,
    idDataUrl: input.idDataUrl,
  })
  if (attestationError) return attestationError

  const resource = buildVisitResourcePayload({
    resourceType: input.resourceType,
    catalogItemId: input.catalogItemId,
    locationId: input.locationId,
    assigneeUserId: input.assigneeUserId,
  })
  if ("error" in resource) return { error: resource.error }

  const resourceOk = await validateVisitResource(auth.supabase, input.siteId, resource)
  if (resourceOk.error) return { error: resourceOk.error }

  const resolved = await resolveVisitLead(auth.supabase, input, {
    asBuyer: opts.asBuyer,
    userId: auth.user.id,
  })
  if ("error" in resolved || !resolved.lead) return { error: resolved.error || "Customer not found" }
  const lead = resolved.lead

  let duration = settings.default_duration_minutes || 60
  if (resource.resource_type === "catalog_item" && resource.catalog_item_id) {
    const { data: schedule } = await auth.supabase
      .from("reservation_schedules")
      .select("duration_minutes")
      .eq("catalog_item_id", resource.catalog_item_id)
      .eq("site_id", input.siteId)
      .limit(1)
      .maybeSingle()
    if (schedule?.duration_minutes) duration = schedule.duration_minutes
  } else {
    if (!input.durationMinutes || input.durationMinutes < 1) {
      return { error: "Duration is required" }
    }
    duration = input.durationMinutes
  }

  const start = new Date()
  const end = new Date(start.getTime() + duration * 60_000)
  const nowIso = start.toISOString()

  let entitlementId: string | null = input.entitlementId || null
  if (entitlementId) {
    const consumed = await consumeVisitEntitlement({
      supabase: auth.supabase,
      siteId: input.siteId,
      entitlementId,
      catalogItemId: resource.catalog_item_id,
    })
    if (consumed.error) return { error: consumed.error }
  }

  const termsText = resolveVisitTermsText(settings.terms_text, input.acceptedTermsText)
  const reservationId = crypto.randomUUID()

  let signatureUrl: string | null = null
  let photoUrl: string | null = null
  let idUrl: string | null = null

  if (input.signatureDataUrl) {
    const up = await uploadAttestation(auth.supabase, input.siteId, reservationId, "signature", input.signatureDataUrl)
    if (up.error) return { error: up.error }
    signatureUrl = up.url || null
  }
  if (input.photoDataUrl) {
    const up = await uploadAttestation(auth.supabase, input.siteId, reservationId, "photo", input.photoDataUrl)
    if (up.error) return { error: up.error }
    photoUrl = up.url || null
  }
  if (input.idDataUrl) {
    const up = await uploadAttestation(auth.supabase, input.siteId, reservationId, "id", input.idDataUrl)
    if (up.error) return { error: up.error }
    idUrl = up.url || null
  }

  const { data: reservation, error: insertError } = await auth.supabase
    .from("reservations")
    .insert({
      id: reservationId,
      site_id: input.siteId,
      lead_id: lead.id,
      buyer_user_id: lead.buyer_user_id || (opts.asBuyer ? auth.user.id : null),
      ...resource,
      status: "completed",
      start_time: nowIso,
      end_time: end.toISOString(),
      notes: input.notes || null,
      quantity: 1,
      entitlement_id: entitlementId,
      channel,
      terms_text: termsText,
      terms_accepted_at: input.termsAccepted ? nowIso : null,
      signature_url: signatureUrl,
      photo_url: photoUrl,
      id_url: idUrl,
      signed_at: signatureUrl ? nowIso : null,
      updated_at: nowIso,
    })
    .select()
    .single()

  if (insertError) return { error: insertError.message }

  if (entitlementId) {
    const { data: entitlement } = await auth.supabase
      .from("entitlements")
      .select("id, catalog_item_id")
      .eq("id", entitlementId)
      .maybeSingle()

    if (entitlement?.catalog_item_id) {
      await auth.supabase.from("ticket_check_ins").insert({
        site_id: input.siteId,
        entitlement_id: entitlement.id,
        catalog_item_id: entitlement.catalog_item_id,
        scanned_by_user_id: auth.user.id,
        code: reservationId,
        status: "valid",
      })
    }
  }

  revalidatePath("/visits")
  revalidatePath("/reservations")
  return { data: reservation as Reservation }
}

export async function registerVisit(input: RegisterVisitInput) {
  try {
    return await registerVisitCore({ ...input, channel: input.channel || "physical" }, { asBuyer: false })
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function registerBuyerVisit(input: Omit<RegisterVisitInput, "leadId" | "channel"> & { leadId?: string }) {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { error: auth.error || "Not logged in" }

    let leadId = input.leadId
    if (!leadId) {
      const { data: lead } = await auth.supabase
        .from("leads")
        .select("id")
        .eq("site_id", input.siteId)
        .eq("buyer_user_id", auth.user.id)
        .maybeSingle()

      if (!lead) {
        const { data: profile } = await auth.supabase
          .from("user_profiles")
          .select("first_name, last_name, email")
          .eq("id", auth.user.id)
          .maybeSingle()

        const name =
          `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim() ||
          auth.user.email ||
          "Customer"

        const { data: created, error: createError } = await auth.supabase
          .from("leads")
          .insert({
            site_id: input.siteId,
            buyer_user_id: auth.user.id,
            name,
            email: profile?.email || auth.user.email || null,
            status: "new",
          })
          .select("id")
          .single()

        if (createError || !created) return { error: createError?.message || "Could not create customer record" }
        leadId = created.id
      } else {
        leadId = lead.id
      }
    }

    return await registerVisitCore({ ...input, leadId, channel: "online" }, { asBuyer: true })
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function listBuyerVisitSites() {
  try {
    const auth = await requireVisitUser()
    if (auth.error || !auth.user) return { data: [], error: auth.error || "Not logged in" }

    const { data: leads } = await auth.supabase
      .from("leads")
      .select("site_id, site:sites(id, name, slug)")
      .eq("buyer_user_id", auth.user.id)

    const { data: entitlements } = await auth.supabase
      .from("entitlements")
      .select("site_id, site:sites(id, name, slug)")
      .eq("buyer_user_id", auth.user.id)

    const map = new Map<string, { id: string; name: string; slug?: string }>()
    for (const row of [...(leads || []), ...(entitlements || [])]) {
      const site = (row as any).site
      if (site?.id) map.set(site.id, { id: site.id, name: site.name, slug: site.slug })
    }

    return { data: Array.from(map.values()) }
  } catch (e: any) {
    return { data: [], error: e.message }
  }
}
