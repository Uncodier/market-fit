-- Function to add credits to a site's billing account
CREATE OR REPLACE FUNCTION add_credits(
  p_site_id UUID,
  p_credits INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the billing record to add credits
  UPDATE billing 
  SET 
    credits_available = COALESCE(credits_available, 0) + p_credits,
    updated_at = NOW()
  WHERE site_id = p_site_id;
  
  -- If no billing record exists, create one
  IF NOT FOUND THEN
    INSERT INTO billing (
      site_id,
      plan,
      credits_available,
      auto_renew,
      created_at,
      updated_at
    ) VALUES (
      p_site_id,
      'commission',
      p_credits,
      true,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'credits_added', p_credits,
    'message', 'Credits added successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Function to create or update billing information
CREATE OR REPLACE FUNCTION upsert_billing(
  p_site_id UUID,
  p_plan TEXT DEFAULT NULL,
  p_card_name TEXT DEFAULT NULL,
  p_masked_card_number TEXT DEFAULT NULL,
  p_card_expiry TEXT DEFAULT NULL,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_payment_method_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_card_address TEXT DEFAULT NULL,
  p_card_city TEXT DEFAULT NULL,
  p_card_postal_code TEXT DEFAULT NULL,
  p_card_country TEXT DEFAULT NULL,
  p_tax_id TEXT DEFAULT NULL,
  p_billing_address TEXT DEFAULT NULL,
  p_billing_city TEXT DEFAULT NULL,
  p_billing_postal_code TEXT DEFAULT NULL,
  p_billing_country TEXT DEFAULT NULL,
  p_auto_renew BOOLEAN DEFAULT NULL,
  p_credits_available INTEGER DEFAULT NULL,
  p_subscription_status TEXT DEFAULT NULL,
  p_subscription_current_period_end TIMESTAMP DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  billing_record billing%ROWTYPE;
BEGIN
  -- Check if billing record exists
  SELECT * INTO billing_record FROM billing WHERE site_id = p_site_id;
  
  IF FOUND THEN
    -- Update existing record
    UPDATE billing SET
      plan = COALESCE(p_plan, plan),
      card_name = COALESCE(p_card_name, card_name),
      masked_card_number = COALESCE(p_masked_card_number, masked_card_number),
      card_expiry = COALESCE(p_card_expiry, card_expiry),
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_payment_method_id = COALESCE(p_stripe_payment_method_id, stripe_payment_method_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      card_address = COALESCE(p_card_address, card_address),
      card_city = COALESCE(p_card_city, card_city),
      card_postal_code = COALESCE(p_card_postal_code, card_postal_code),
      card_country = COALESCE(p_card_country, card_country),
      tax_id = COALESCE(p_tax_id, tax_id),
      billing_address = COALESCE(p_billing_address, billing_address),
      billing_city = COALESCE(p_billing_city, billing_city),
      billing_postal_code = COALESCE(p_billing_postal_code, billing_postal_code),
      billing_country = COALESCE(p_billing_country, billing_country),
      auto_renew = COALESCE(p_auto_renew, auto_renew),
      credits_available = COALESCE(p_credits_available, credits_available),
      subscription_status = COALESCE(p_subscription_status, subscription_status),
      subscription_current_period_end = COALESCE(p_subscription_current_period_end, subscription_current_period_end),
      updated_at = NOW()
    WHERE site_id = p_site_id;
  ELSE
    -- Create new record
    INSERT INTO billing (
      site_id,
      plan,
      card_name,
      masked_card_number,
      card_expiry,
      stripe_customer_id,
      stripe_payment_method_id,
      stripe_subscription_id,
      card_address,
      card_city,
      card_postal_code,
      card_country,
      tax_id,
      billing_address,
      billing_city,
      billing_postal_code,
      billing_country,
      auto_renew,
      credits_available,
      subscription_status,
      subscription_current_period_end,
      created_at,
      updated_at
    ) VALUES (
      p_site_id,
      COALESCE(p_plan, 'commission'),
      p_card_name,
      p_masked_card_number,
      p_card_expiry,
      p_stripe_customer_id,
      p_stripe_payment_method_id,
      p_stripe_subscription_id,
      p_card_address,
      p_card_city,
      p_card_postal_code,
      p_card_country,
      p_tax_id,
      p_billing_address,
      p_billing_city,
      p_billing_postal_code,
      p_billing_country,
      COALESCE(p_auto_renew, true),
      COALESCE(p_credits_available, 0),
      p_subscription_status,
      p_subscription_current_period_end,
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Billing information updated successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_session_id TEXT,
  stripe_invoice_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL,
  type TEXT NOT NULL, -- 'credits_purchase', 'subscription', etc.
  credits_purchased INTEGER,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_site_id ON payments(site_id);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);

-- Add RLS policies for payments table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Users can only see payments for sites they have access to
CREATE POLICY "Users can view payments for their sites" ON payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM site_members sm
      WHERE sm.site_id = payments.site_id
      AND sm.user_id = auth.uid()
    )
  );

-- Only the system can insert payments (via service role)
CREATE POLICY "System can insert payments" ON payments
  FOR INSERT
  WITH CHECK (true);

-- Add missing columns to billing table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE billing ADD COLUMN stripe_subscription_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'subscription_status') THEN
    ALTER TABLE billing ADD COLUMN subscription_status TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing' AND column_name = 'subscription_current_period_end') THEN
    ALTER TABLE billing ADD COLUMN subscription_current_period_end TIMESTAMP WITH TIME ZONE;
  END IF;
END $$; 