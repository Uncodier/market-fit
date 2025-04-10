-- Create billing table
CREATE TABLE IF NOT EXISTS billing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  card_name VARCHAR(255),
  masked_card_number VARCHAR(19), -- Only store last 4 digits with mask (e.g., •••• •••• •••• 1234)
  card_expiry VARCHAR(7), -- MM/YYYY format
  stripe_customer_id VARCHAR(255),
  stripe_payment_method_id VARCHAR(255),
  card_address VARCHAR(255),
  card_city VARCHAR(100),
  card_postal_code VARCHAR(20),
  card_country VARCHAR(100),
  tax_id VARCHAR(100),
  billing_address VARCHAR(255),
  billing_city VARCHAR(100),
  billing_postal_code VARCHAR(20),
  billing_country VARCHAR(100),
  auto_renew BOOLEAN DEFAULT true,
  credits_available INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_billing_timestamp
BEFORE UPDATE ON billing
FOR EACH ROW
EXECUTE FUNCTION update_billing_updated_at();

-- Create function for upsert operation
CREATE OR REPLACE FUNCTION upsert_billing(
  p_site_id UUID,
  p_plan VARCHAR,
  p_card_name VARCHAR DEFAULT NULL,
  p_masked_card_number VARCHAR DEFAULT NULL,
  p_card_expiry VARCHAR DEFAULT NULL,
  p_stripe_customer_id VARCHAR DEFAULT NULL,
  p_stripe_payment_method_id VARCHAR DEFAULT NULL,
  p_card_address VARCHAR DEFAULT NULL,
  p_card_city VARCHAR DEFAULT NULL,
  p_card_postal_code VARCHAR DEFAULT NULL,
  p_card_country VARCHAR DEFAULT NULL,
  p_tax_id VARCHAR DEFAULT NULL,
  p_billing_address VARCHAR DEFAULT NULL,
  p_billing_city VARCHAR DEFAULT NULL,
  p_billing_postal_code VARCHAR DEFAULT NULL,
  p_billing_country VARCHAR DEFAULT NULL,
  p_auto_renew BOOLEAN DEFAULT true,
  p_credits_available INTEGER DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Try to find existing record first
  SELECT id INTO v_id FROM billing WHERE site_id = p_site_id;
  
  -- If exists, update
  IF v_id IS NOT NULL THEN
    UPDATE billing
    SET 
      plan = p_plan,
      card_name = p_card_name,
      masked_card_number = p_masked_card_number,
      card_expiry = p_card_expiry,
      stripe_customer_id = p_stripe_customer_id,
      stripe_payment_method_id = p_stripe_payment_method_id,
      card_address = p_card_address,
      card_city = p_card_city,
      card_postal_code = p_card_postal_code,
      card_country = p_card_country,
      tax_id = p_tax_id,
      billing_address = p_billing_address,
      billing_city = p_billing_city,
      billing_postal_code = p_billing_postal_code,
      billing_country = p_billing_country,
      auto_renew = p_auto_renew,
      credits_available = p_credits_available,
      updated_at = NOW()
    WHERE id = v_id;
  
  -- Otherwise, insert new record
  ELSE
    INSERT INTO billing (
      site_id, 
      plan, 
      card_name, 
      masked_card_number,
      card_expiry,
      stripe_customer_id,
      stripe_payment_method_id,
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
      credits_available
    ) VALUES (
      p_site_id,
      p_plan,
      p_card_name,
      p_masked_card_number,
      p_card_expiry,
      p_stripe_customer_id,
      p_stripe_payment_method_id,
      p_card_address,
      p_card_city,
      p_card_postal_code,
      p_card_country,
      p_tax_id,
      p_billing_address,
      p_billing_city,
      p_billing_postal_code,
      p_billing_country,
      p_auto_renew,
      p_credits_available
    )
    RETURNING id INTO v_id;
  END IF;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;

-- Policy for selecting billing info (only site owners)
CREATE POLICY select_billing ON billing
  FOR SELECT
  USING (
    site_id IN (
      SELECT site_id FROM site_members 
      WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
    )
  );

-- Policy for inserting billing info (only site owners)
CREATE POLICY insert_billing ON billing
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT site_id FROM site_members 
      WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
    )
  );

-- Policy for updating billing info (only site owners)
CREATE POLICY update_billing ON billing
  FOR UPDATE
  USING (
    site_id IN (
      SELECT site_id FROM site_members 
      WHERE user_id = auth.uid() AND (role = 'admin' OR role = 'owner')
    )
  ); 