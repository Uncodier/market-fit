CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    requested_credits NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rejected')),
    bank_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Users can view payout_requests for their sites"
ON public.payout_requests FOR SELECT
USING (
    site_id IN (
        SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
);

-- Insert policy (only for their sites)
CREATE POLICY "Users can insert payout_requests for their sites"
ON public.payout_requests FOR INSERT
WITH CHECK (
    site_id IN (
        SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
);

-- Note: Updates are mostly done by admins/service role, but we might want users to cancel them
CREATE POLICY "Users can update their pending payout_requests"
ON public.payout_requests FOR UPDATE
USING (
    site_id IN (
        SELECT site_id FROM public.site_members WHERE user_id = auth.uid()
    )
    AND status = 'pending'
);

-- Trigger for updated_at
CREATE TRIGGER set_updated_at_payout_requests
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add webhook event processed type if needed, but we already have handle_updated_at.
