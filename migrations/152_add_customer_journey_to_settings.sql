-- Add customer_journey column to settings table
-- This stores customer journey configuration including metrics, actions, and tactics for each stage

-- Add the customer_journey column as JSONB
ALTER TABLE public.settings 
ADD COLUMN customer_journey JSONB DEFAULT '{
  "awareness": {"metrics": [], "actions": [], "tactics": []},
  "consideration": {"metrics": [], "actions": [], "tactics": []},
  "decision": {"metrics": [], "actions": [], "tactics": []},
  "purchase": {"metrics": [], "actions": [], "tactics": []},
  "retention": {"metrics": [], "actions": [], "tactics": []},
  "referral": {"metrics": [], "actions": [], "tactics": []}
}'::jsonb;

-- Add comment to document the column purpose
COMMENT ON COLUMN public.settings.customer_journey IS 'Customer journey configuration with metrics, actions, and tactics for each stage: awareness, consideration, decision, purchase, retention, and referral';

-- Add validation constraints to ensure proper structure
ALTER TABLE public.settings 
ADD CONSTRAINT customer_journey_structure_check 
CHECK (
  customer_journey ? 'awareness' AND
  customer_journey ? 'consideration' AND
  customer_journey ? 'decision' AND
  customer_journey ? 'purchase' AND
  customer_journey ? 'retention' AND
  customer_journey ? 'referral' AND
  jsonb_typeof(customer_journey->'awareness') = 'object' AND
  jsonb_typeof(customer_journey->'consideration') = 'object' AND
  jsonb_typeof(customer_journey->'decision') = 'object' AND
  jsonb_typeof(customer_journey->'purchase') = 'object' AND
  jsonb_typeof(customer_journey->'retention') = 'object' AND
  jsonb_typeof(customer_journey->'referral') = 'object'
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_settings_customer_journey_gin 
ON public.settings USING gin (customer_journey);

-- Create specific indexes for each stage if needed for advanced queries
CREATE INDEX IF NOT EXISTS idx_settings_customer_journey_awareness 
ON public.settings USING gin ((customer_journey->'awareness'));

CREATE INDEX IF NOT EXISTS idx_settings_customer_journey_purchase 
ON public.settings USING gin ((customer_journey->'purchase'));

-- Update existing rows to have the default structure
UPDATE public.settings 
SET customer_journey = '{
  "awareness": {"metrics": [], "actions": [], "tactics": []},
  "consideration": {"metrics": [], "actions": [], "tactics": []},
  "decision": {"metrics": [], "actions": [], "tactics": []},
  "purchase": {"metrics": [], "actions": [], "tactics": []},
  "retention": {"metrics": [], "actions": [], "tactics": []},
  "referral": {"metrics": [], "actions": [], "tactics": []}
}'::jsonb
WHERE customer_journey IS NULL; 