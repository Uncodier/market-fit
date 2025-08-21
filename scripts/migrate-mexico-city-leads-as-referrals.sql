-- Script to create new leads in target site based on Mexico City leads
-- For ALL Mexico City leads that have a different site_id and different email
-- These will be marked as referrals from the original leads

-- Set service_role to bypass RLS and permission checks
SET ROLE service_role;

-- Target site ID
-- e91bfcf3-0b81-43e2-bc3e-98c715b52ea2

-- First, let's see what leads we'll be migrating (optional check)
-- SELECT 
--     l.id as original_lead_id,
--     l.name,
--     l.email,
--     l.site_id as original_site_id,
--     l.address->>'city' as city
-- FROM public.leads l
-- WHERE 
--     -- Must have defined site_id and email
--     l.site_id IS NOT NULL 
--     AND l.email IS NOT NULL 
--     AND l.email != ''
--     -- Must be from Ciudad de México
--     AND (
--         l.address->>'city' ILIKE '%ciudad de méxico%'
--         OR l.address->>'city' ILIKE '%ciudad de mexico%'
--         OR l.address->>'city' ILIKE '%cdmx%'
--         OR l.address->>'city' ILIKE '%mexico city%'
--         OR l.address->>'city' ILIKE '%df%'
--         OR l.address->>'city' ILIKE '%distrito federal%'
--     )
--     -- Must be from a DIFFERENT site (not target site)
--     AND l.site_id != 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
--     -- Must have DIFFERENT email (no duplicates)
--     AND NOT EXISTS (
--         SELECT 1 FROM public.leads existing
--         WHERE existing.email = l.email 
--         AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
--     );

-- Insert new leads as referrals from Mexico City leads
INSERT INTO public.leads (
    name,
    email,
    phone,
    position,
    status,
    notes,
    site_id,
    user_id,
    origin,
    social_networks,
    address,
    company,
    subscription,
    birthday,
    language,
    attribution,
    metadata,
    referral_lead_id,
    -- Explicitly setting these to NULL to clean site-specific data
    segment_id,
    campaign_id,
    command_id,
    company_id,
    assignee_id
)
SELECT 
    l.name,
    l.email,
    l.phone,
    l.position,
    'new' as status, -- Reset status for new site
    COALESCE(l.notes, '') || ' | Migrated from Mexico City leads as referral' as notes,
    'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2' as site_id, -- Target site
    (SELECT user_id FROM public.sites WHERE id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2') as user_id, -- Owner of target site
    'referral_migration' as origin,
    l.social_networks,
    l.address,
    l.company,
    l.subscription,
    l.birthday,
    l.language,
    l.attribution,
    -- Add migration info to metadata
    COALESCE(l.metadata, '{}'::jsonb) || jsonb_build_object(
        'migration', jsonb_build_object(
            'migrated_from_site', l.site_id,
            'migration_date', now(),
            'migration_reason', 'mexico_city_referral_program',
            'original_lead_id', l.id
        )
    ) as metadata,
    l.id as referral_lead_id, -- Original lead becomes the referrer
    -- Clean site-specific data
    NULL as segment_id,
    NULL as campaign_id,
    NULL as command_id,
    NULL as company_id,
    NULL as assignee_id
FROM public.leads l
WHERE 
    -- Condition 1: Must have defined site_id and email
    l.site_id IS NOT NULL 
    AND l.email IS NOT NULL 
    AND l.email != ''
    
    -- Condition 2: Must be from Ciudad de México (or similar)
    AND (
        l.address->>'city' ILIKE '%ciudad de méxico%'
        OR l.address->>'city' ILIKE '%ciudad de mexico%'
        OR l.address->>'city' ILIKE '%cdmx%'
        OR l.address->>'city' ILIKE '%mexico city%'
        OR l.address->>'city' ILIKE '%df%'
        OR l.address->>'city' ILIKE '%distrito federal%'
    )
    
    -- Condition 3: Must be from a DIFFERENT site (not the target site)
    AND l.site_id != 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    
    -- Condition 4: Must NOT already exist in target site with same email (avoid duplicates)
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    )
    
    -- Condition 5: Extra safety - ensure this exact lead (same site + email) doesn't already exist in target
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
        AND existing.referral_lead_id = l.id
    );

-- Get summary of what was migrated
SELECT 
    COUNT(*) as leads_migrated,
    'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2' as target_site_id
FROM public.leads 
WHERE site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
AND origin = 'referral_migration'
AND created_at >= now() - interval '1 minute';

-- Optional: Verify the referral relationships
-- SELECT 
--     new_lead.id as new_lead_id,
--     new_lead.name,
--     new_lead.email,
--     new_lead.site_id as new_site_id,
--     original_lead.id as original_lead_id,
--     original_lead.site_id as original_site_id,
--     new_lead.metadata->'migration'->>'migrated_from_site' as migrated_from_site
-- FROM public.leads new_lead
-- JOIN public.leads original_lead ON new_lead.referral_lead_id = original_lead.id
-- WHERE new_lead.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
-- AND new_lead.origin = 'referral_migration'
-- ORDER BY new_lead.created_at DESC;

-- Reset role back to default after execution
RESET ROLE;
