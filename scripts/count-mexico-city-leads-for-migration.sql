-- Count and preview Mexico City leads that will be migrated
-- Use this to review the selection BEFORE running the actual migration

-- Set service_role to bypass RLS and permission checks
SET ROLE service_role;

-- Target site ID: e91bfcf3-0b81-43e2-bc3e-98c715b52ea2

-- 1. COUNT of leads that will be migrated
SELECT 
    COUNT(*) as total_leads_to_migrate,
    COUNT(DISTINCT l.site_id) as different_source_sites,
    COUNT(DISTINCT l.address->>'city') as different_city_variations
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
    
    -- Condition 5: Extra safety - ensure this exact lead doesn't already exist in target
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
        AND existing.referral_lead_id = l.id
    );

-- 2. BREAKDOWN by source site
SELECT 
    l.site_id as source_site_id,
    COUNT(*) as leads_count,
    STRING_AGG(DISTINCT l.address->>'city', ', ') as city_variations
FROM public.leads l
WHERE 
    l.site_id IS NOT NULL 
    AND l.email IS NOT NULL 
    AND l.email != ''
    AND (
        l.address->>'city' ILIKE '%ciudad de méxico%'
        OR l.address->>'city' ILIKE '%ciudad de mexico%'
        OR l.address->>'city' ILIKE '%cdmx%'
        OR l.address->>'city' ILIKE '%mexico city%'
        OR l.address->>'city' ILIKE '%df%'
        OR l.address->>'city' ILIKE '%distrito federal%'
    )
    AND l.site_id != 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
        AND existing.referral_lead_id = l.id
    )
GROUP BY l.site_id
ORDER BY leads_count DESC;

-- 3. SAMPLE of leads that will be migrated (first 10)
SELECT 
    l.id as original_lead_id,
    l.name,
    l.email,
    l.site_id as source_site_id,
    l.address->>'city' as city,
    l.address->>'state' as state,
    l.status as current_status,
    l.created_at as original_created_at
FROM public.leads l
WHERE 
    l.site_id IS NOT NULL 
    AND l.email IS NOT NULL 
    AND l.email != ''
    AND (
        l.address->>'city' ILIKE '%ciudad de méxico%'
        OR l.address->>'city' ILIKE '%ciudad de mexico%'
        OR l.address->>'city' ILIKE '%cdmx%'
        OR l.address->>'city' ILIKE '%mexico city%'
        OR l.address->>'city' ILIKE '%df%'
        OR l.address->>'city' ILIKE '%distrito federal%'
    )
    AND l.site_id != 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.leads existing
        WHERE existing.email = l.email 
        AND existing.site_id = 'e91bfcf3-0b81-43e2-bc3e-98c715b52ea2'
        AND existing.referral_lead_id = l.id
    )
ORDER BY l.created_at DESC
LIMIT 10;

-- Reset role back to default after execution
RESET ROLE;
