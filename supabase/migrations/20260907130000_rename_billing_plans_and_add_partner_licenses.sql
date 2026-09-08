-- Step 1: Update existing billing plans in the database
UPDATE billing SET plan = 'engine' WHERE plan = 'starter';
UPDATE billing SET plan = 'foundry' WHERE plan = 'startup';

-- Step 2: Update the check constraint to allow the new names
DO $$
BEGIN
  BEGIN
    ALTER TABLE billing DROP CONSTRAINT IF EXISTS billing_plan_check;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    ALTER TABLE billing ADD CONSTRAINT billing_plan_check CHECK (plan IN ('commission', 'engine', 'foundry', 'enterprise'));
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
END $$;

-- Step 3: Create partner_licenses table
CREATE TABLE IF NOT EXISTS public.partner_licenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_key uuid NOT NULL UNIQUE,
  parent_license_key uuid,
  partner varchar(255) NOT NULL,
  status varchar(255) NOT NULL,
  plan_name varchar(255) NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partner_licenses ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Users can view their own partner licenses" ON public.partner_licenses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all partner licenses" ON public.partner_licenses
  FOR ALL USING (true);
