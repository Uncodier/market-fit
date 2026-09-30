import type { SupabaseClient } from "@supabase/supabase-js"
import { cohortBaselines, retentionRows } from "./retention"
import { readCohortActivity, readCohortLeads, readCohortSales } from "./queries"
import type { CohortMetadata, CohortScope } from "./types"

const ACTIVITY_DEFINITION = "Share of cohort leads with recorded user or visitor messages in lead-linked conversations during each subsequent complete UTC week; not website usage. Only records visible under the current user's access are included."
const CUSTOMER_DEFINITION = "Each identified lead enters once at its first observed confirmed sale (current status pending or completed, using sales.created_at) within the selected window and sales segment. Subsequent sales retention measures another confirmed sale. This is not lifetime-first purchase or paid-invoice retention."
const LEAD_DEFINITION = "Leads created within the selected window, grouped by leads.created_at and filtered by their current segment. Subsequent retention measures recorded user or visitor messages in lead-linked conversations, not continued presence in the database."

function metadata(scope: CohortScope, definition: string, activity: Awaited<ReturnType<typeof readCohortActivity>>): CohortMetadata {
  return {
    definition,
    startDate: scope.startDate,
    endDate: scope.endDate,
    observationEnd: scope.observationEnd,
    weekStartsOn: "Monday",
    observationPolicy: "complete-weeks-only",
    activityDefinition: ACTIVITY_DEFINITION,
    activityAvailable: activity.available,
    ...(!activity.available ? { activityUnavailableReason: activity.reason } : {}),
  }
}

export async function customerCohortReport(client: Pick<SupabaseClient, "from">, scope: CohortScope) {
  const sales = await readCohortSales(client, scope)
  const confirmed = sales.filter(sale => sale.status === "pending" || sale.status === "completed")
  const events = confirmed.filter(sale => sale.lead_id).map(sale => ({ leadId: sale.lead_id!, at: sale.created_at }))
  const baseline = cohortBaselines(events, scope)
  const activity = await readCohortActivity(client, scope, baseline.map(event => event.leadId))
  return {
    salesCohorts: retentionRows(baseline, events, scope),
    usageCohorts: retentionRows(baseline, activity.events, scope),
    metadata: {
      ...metadata(scope, CUSTOMER_DEFINITION, activity),
      usageDefinition: ACTIVITY_DEFINITION,
      excludedAnonymousSales: confirmed.filter(sale => !sale.lead_id).length,
    },
  }
}

export async function leadCohortReport(client: Pick<SupabaseClient, "from">, scope: CohortScope) {
  const leads = await readCohortLeads(client, scope)
  const baseline = cohortBaselines(leads.map(lead => ({ leadId: lead.id, at: lead.created_at })), scope)
  const activity = await readCohortActivity(client, scope, baseline.map(event => event.leadId))
  return {
    leadCohorts: retentionRows(baseline, activity.events, scope),
    metadata: metadata(scope, LEAD_DEFINITION, activity),
  }
}