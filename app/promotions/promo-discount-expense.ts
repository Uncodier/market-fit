type DbClient = {
  from: (table: string) => any;
};

/**
 * Idempotently record a promotion discount as a variable marketing expense
 * linked to the sale order (one expense row per order).
 */
export async function upsertPromotionDiscountExpense(params: {
  supabase: DbClient;
  siteId: string;
  saleOrderId: string;
  discount: number;
  campaignId: string | null;
  leadId: string | null;
  locationId: string | null;
  userId: string | null;
  currency: string;
  date: string;
  promotionCode?: string | null;
  promotionName?: string | null;
}) {
  const {
    supabase,
    siteId,
    saleOrderId,
    discount,
    campaignId,
    leadId,
    locationId,
    userId,
    currency,
    date,
    promotionCode,
    promotionName,
  } = params;

  if (!(discount > 0)) return { skipped: true as const };

  const label = promotionCode || promotionName || 'promotion';
  const description = `Promotion discount: ${label} — order ${saleOrderId}`;

  const payload = {
    site_id: siteId,
    user_id: userId,
    campaign_id: campaignId,
    location_id: locationId,
    lead_id: leadId,
    sale_order_id: saleOrderId,
    type: 'variable' as const,
    amount: discount,
    description,
    category: 'promotions',
    date,
    currency: currency || 'USD',
    accounting_state: 'pending',
  };

  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select('id')
    .eq('sale_order_id', saleOrderId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Failed to look up promotion expense: ${existingError.message}`
    );
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({
        amount: payload.amount,
        description: payload.description,
        campaign_id: payload.campaign_id,
        location_id: payload.location_id,
        lead_id: payload.lead_id,
        category: payload.category,
        date: payload.date,
        currency: payload.currency,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw new Error(
        `Failed to update promotion expense: ${updateError.message}`
      );
    }
  } else {
    const { error: insertError } = await supabase
      .from('transactions')
      .insert(payload);

    if (insertError) {
      // Race: another request inserted first — update instead
      if (insertError.code === '23505') {
        const { error: retryError } = await supabase
          .from('transactions')
          .update({
            amount: payload.amount,
            description: payload.description,
            campaign_id: payload.campaign_id,
            location_id: payload.location_id,
            lead_id: payload.lead_id,
            category: payload.category,
            date: payload.date,
            currency: payload.currency,
          })
          .eq('sale_order_id', saleOrderId);
        if (retryError) {
          throw new Error(
            `Failed to upsert promotion expense: ${retryError.message}`
          );
        }
      } else {
        throw new Error(
          `Failed to create promotion expense: ${insertError.message}`
        );
      }
    }
  }

  if (campaignId) {
    await refreshCampaignBudgetRemaining(supabase, campaignId);
  }

  return { skipped: false as const };
}

async function refreshCampaignBudgetRemaining(
  supabase: DbClient,
  campaignId: string
) {
  const { data: transactions, error: transactionError } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('campaign_id', campaignId);

  if (transactionError) {
    console.error(
      'Error fetching campaign transactions for promo cost:',
      transactionError
    );
    return;
  }

  let totalCosts = 0;
  for (const transaction of transactions || []) {
    totalCosts += parseFloat(String(transaction.amount)) || 0;
  }

  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('budget')
    .eq('id', campaignId)
    .single();

  if (campaignError || !campaign) {
    console.error('Error fetching campaign for promo cost:', campaignError);
    return;
  }

  const allocated = campaign.budget?.allocated || 0;
  const { error: updateError } = await supabase
    .from('campaigns')
    .update({
      budget: {
        ...campaign.budget,
        remaining: allocated - totalCosts,
      },
    })
    .eq('id', campaignId);

  if (updateError) {
    console.error('Error updating campaign budget for promo cost:', updateError);
  }
}
