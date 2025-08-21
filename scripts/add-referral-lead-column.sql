-- Add referral system for leads (lead-to-lead referrals)
-- This allows tracking when a lead was referred by another lead

-- Option 1: Simple approach - Add a single column
ALTER TABLE public.leads 
ADD COLUMN referral_lead_id uuid REFERENCES public.leads(id);

-- Add index for performance when querying referrals
CREATE INDEX idx_leads_referral_lead_id ON public.leads(referral_lead_id);

-- Option 2: Enhanced approach - Use metadata JSONB for more referral info
-- (You can use this in addition to or instead of the column above)

-- Example of how to store referral data in metadata:
-- UPDATE public.leads 
-- SET metadata = metadata || jsonb_build_object(
--     'referral', jsonb_build_object(
--         'referral_lead_id', 'uuid-of-referring-lead',
--         'referral_date', now(),
--         'referral_method', 'direct_link', -- 'email', 'whatsapp', 'social', etc.
--         'referral_campaign', 'friend_referral_2024',
--         'incentive_offered', 'discount_10_percent'
--     )
-- )
-- WHERE id = 'lead-id-that-was-referred';

-- Useful queries after implementation:

-- 1. Get all leads referred by a specific lead
-- SELECT * FROM public.leads 
-- WHERE referral_lead_id = 'referring-lead-uuid';

-- 2. Get lead with referrer information
-- SELECT 
--     l.*,
--     r.name as referrer_name,
--     r.email as referrer_email
-- FROM public.leads l
-- LEFT JOIN public.leads r ON l.referral_lead_id = r.id
-- WHERE l.id = 'lead-uuid';

-- 3. Count referrals per lead (leaderboard)
-- SELECT 
--     r.id,
--     r.name,
--     r.email,
--     COUNT(l.id) as total_referrals
-- FROM public.leads r
-- LEFT JOIN public.leads l ON r.id = l.referral_lead_id
-- GROUP BY r.id, r.name, r.email
-- HAVING COUNT(l.id) > 0
-- ORDER BY total_referrals DESC;

-- 4. Get referral chain (who referred whom)
-- WITH RECURSIVE referral_chain AS (
--     -- Base case: leads without referrer
--     SELECT id, name, email, referral_lead_id, 0 as level
--     FROM public.leads 
--     WHERE referral_lead_id IS NULL
--     
--     UNION ALL
--     
--     -- Recursive case: leads with referrer
--     SELECT l.id, l.name, l.email, l.referral_lead_id, rc.level + 1
--     FROM public.leads l
--     JOIN referral_chain rc ON l.referral_lead_id = rc.id
-- )
-- SELECT * FROM referral_chain ORDER BY level, name;
