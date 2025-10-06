-- Script to get all leads with defined site_id and email, 
-- and with address.city containing "Ciudad de México" or similar variations

SELECT 
    l.id,
    l.name,
    l.email,
    l.phone,
    l.site_id,
    l.address->>'city' as city,
    l.address->>'state' as state,
    l.address->>'country' as country,
    l.address->>'street' as street,
    l.address->>'zip' as zip_code,
    l.status,
    l.created_at,
    l.updated_at,
    l.campaign_id,
    l.segment_id,
    l.company_id,
    l.position,
    l.origin
FROM public.leads l
WHERE 
    -- Condition A: site_id and email are well defined (NOT NULL constraints already ensure this)
    l.site_id IS NOT NULL 
    AND l.email IS NOT NULL 
    AND l.email != ''
    
    -- Condition B: address.city contains "Ciudad de México" or similar variations
    AND (
        l.address->>'city' ILIKE '%ciudad de méxico%'
        OR l.address->>'city' ILIKE '%ciudad de mexico%'
        OR l.address->>'city' ILIKE '%cdmx%'
        OR l.address->>'city' ILIKE '%mexico city%'
        OR l.address->>'city' ILIKE '%df%'
        OR l.address->>'city' ILIKE '%distrito federal%'
    )
ORDER BY l.created_at DESC;

