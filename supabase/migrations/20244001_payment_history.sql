-- Function to get payment history for a site
CREATE OR REPLACE FUNCTION get_payment_history(p_site_id UUID)
RETURNS TABLE (
  id UUID,
  transaction_id VARCHAR,
  transaction_type VARCHAR,
  amount DECIMAL,
  status VARCHAR,
  details JSONB,
  credits INTEGER,
  invoice_url VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.transaction_id,
    p.transaction_type,
    p.amount,
    p.status,
    p.details,
    p.credits,
    p.invoice_url,
    p.created_at
  FROM payments p
  WHERE p.site_id = p_site_id
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql; 