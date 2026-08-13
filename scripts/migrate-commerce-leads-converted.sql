-- Backfill leads that already have a completed POS / Shop / Marketplace sale.
-- Sets status=converted, attribution, origin (only if blank/inbound), and journey tasks.
-- Idempotent: safe to re-run.
--
-- Legacy sales.source values: retail → pos, online → shop.
-- Does not overwrite campaign origins (website, referral, etc.).
-- Does not overwrite attribution if the lead is already converted with a non-empty payload.
--
-- Usage: run in the SQL editor (service role) or: psql $DATABASE_URL -f scripts/migrate-commerce-leads-converted.sql

SET ROLE service_role;

-- ---------------------------------------------------------------------------
-- Eligible leads: latest completed commerce sale per lead_id
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE tmp_commerce_converted_leads AS
SELECT DISTINCT ON (s.lead_id)
  s.lead_id,
  s.site_id,
  COALESCE(s.user_id, l.user_id) AS user_id,
  l.name AS lead_name,
  l.status AS current_status,
  l.origin AS current_origin,
  s.amount,
  s.created_at AS purchased_at,
  CASE
    WHEN s.source IN ('pos', 'retail') THEN 'pos'
    WHEN s.source IN ('shop', 'online') THEN 'shop'
    WHEN s.source = 'marketplace' THEN 'marketplace'
  END AS channel
FROM public.sales s
JOIN public.leads l ON l.id = s.lead_id
WHERE s.status = 'completed'
  AND s.lead_id IS NOT NULL
  AND s.source IN ('pos', 'shop', 'marketplace', 'retail', 'online')
ORDER BY s.lead_id, s.created_at DESC;

-- ---------------------------------------------------------------------------
-- 1. Preview
-- ---------------------------------------------------------------------------
SELECT
  channel,
  current_status,
  COUNT(*) AS leads,
  COUNT(*) FILTER (
    WHERE current_status IS DISTINCT FROM 'converted'
  ) AS will_convert,
  COUNT(*) FILTER (
    WHERE current_origin IS NULL
      OR btrim(current_origin) = ''
      OR lower(current_origin) = 'inbound'
  ) AS will_set_origin
FROM tmp_commerce_converted_leads
GROUP BY channel, current_status
ORDER BY channel, current_status;

SELECT
  t.lead_id,
  t.lead_name,
  t.channel,
  t.current_status,
  t.current_origin,
  t.amount,
  t.purchased_at,
  EXISTS (
    SELECT 1 FROM public.tasks x
    WHERE x.lead_id = t.lead_id AND x.site_id = t.site_id AND x.type = 'payment'
  ) AS has_payment_task,
  EXISTS (
    SELECT 1 FROM public.tasks x
    WHERE x.lead_id = t.lead_id AND x.site_id = t.site_id AND x.type = 'website_visit'
  ) AS has_visit_task
FROM tmp_commerce_converted_leads t
ORDER BY t.purchased_at DESC
LIMIT 50;

-- ---------------------------------------------------------------------------
-- 2. Convert + origin + attribution
-- ---------------------------------------------------------------------------
UPDATE public.leads l
SET
  status = 'converted',
  origin = CASE
    WHEN l.origin IS NULL
      OR btrim(l.origin) = ''
      OR lower(l.origin) = 'inbound'
    THEN t.channel
    ELSE l.origin
  END,
  attribution = CASE
    WHEN l.status IS DISTINCT FROM 'converted'
      OR l.attribution IS NULL
      OR l.attribution = '{}'::jsonb
    THEN jsonb_build_object(
      'user_id', t.user_id::text,
      'user_name', CASE t.channel
        WHEN 'pos' THEN 'POS'
        WHEN 'shop' THEN 'Shop'
        ELSE 'Marketplace'
      END,
      'date', to_char(t.purchased_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'final_amount', t.amount,
      'is_market_fit_influenced', false,
      'notes', 'Auto-converted from ' || t.channel || ' purchase'
    )
    ELSE l.attribution
  END,
  updated_at = now()
FROM tmp_commerce_converted_leads t
WHERE l.id = t.lead_id
  AND (
    l.status IS DISTINCT FROM 'converted'
    OR l.origin IS NULL
    OR btrim(l.origin) = ''
    OR lower(l.origin) = 'inbound'
    OR l.attribution IS NULL
    OR l.attribution = '{}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- 3. Payment task (all channels)
-- ---------------------------------------------------------------------------
INSERT INTO public.tasks (
  lead_id,
  title,
  description,
  type,
  stage,
  status,
  scheduled_date,
  completed_date,
  amount,
  site_id,
  user_id
)
SELECT
  t.lead_id,
  'Purchase: ' || COALESCE(t.lead_name, t.channel),
  'Completed ' || CASE t.channel
    WHEN 'pos' THEN 'POS'
    WHEN 'shop' THEN 'Shop'
    ELSE 'Marketplace'
  END || ' purchase.',
  'payment',
  'purchase',
  'completed',
  t.purchased_at,
  t.purchased_at,
  t.amount,
  t.site_id,
  t.user_id
FROM tmp_commerce_converted_leads t
WHERE NOT EXISTS (
  SELECT 1
  FROM public.tasks x
  WHERE x.lead_id = t.lead_id
    AND x.site_id = t.site_id
    AND x.type = 'payment'
);

-- ---------------------------------------------------------------------------
-- 4. Website visit (shop / marketplace only)
-- ---------------------------------------------------------------------------
INSERT INTO public.tasks (
  lead_id,
  title,
  description,
  type,
  stage,
  status,
  scheduled_date,
  completed_date,
  site_id,
  user_id
)
SELECT
  t.lead_id,
  'Website visit: ' || COALESCE(t.lead_name, t.channel),
  COALESCE(t.lead_name, 'Customer') || ' visited the ' || t.channel || ' and started checkout.',
  'website_visit',
  'awareness',
  'completed',
  t.purchased_at,
  t.purchased_at,
  t.site_id,
  t.user_id
FROM tmp_commerce_converted_leads t
WHERE t.channel IN ('shop', 'marketplace')
  AND NOT EXISTS (
    SELECT 1
    FROM public.tasks x
    WHERE x.lead_id = t.lead_id
      AND x.site_id = t.site_id
      AND x.type = 'website_visit'
  );

-- ---------------------------------------------------------------------------
-- 5. Summary
-- ---------------------------------------------------------------------------
SELECT
  t.channel,
  COUNT(*) AS leads,
  COUNT(*) FILTER (WHERE l.status = 'converted') AS converted,
  COUNT(*) FILTER (WHERE l.origin = t.channel) AS origin_matches_channel,
  COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM public.tasks x
      WHERE x.lead_id = t.lead_id AND x.site_id = t.site_id AND x.type = 'payment'
    )
  ) AS with_payment_task,
  COUNT(*) FILTER (
    WHERE t.channel IN ('shop', 'marketplace')
      AND EXISTS (
        SELECT 1 FROM public.tasks x
        WHERE x.lead_id = t.lead_id AND x.site_id = t.site_id AND x.type = 'website_visit'
      )
  ) AS with_visit_task
FROM tmp_commerce_converted_leads t
JOIN public.leads l ON l.id = t.lead_id
GROUP BY t.channel
ORDER BY t.channel;

DROP TABLE tmp_commerce_converted_leads;

RESET ROLE;
