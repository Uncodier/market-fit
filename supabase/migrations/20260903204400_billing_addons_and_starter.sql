-- Add addons_count to billing table
ALTER TABLE billing ADD COLUMN IF NOT EXISTS addons_count INT NOT NULL DEFAULT 0;

-- Depending on how plan is defined (enum vs check), we need to allow 'starter'
-- If it's a check constraint on plan:
DO $$
BEGIN
  -- Attempt to drop a check constraint if it exists (commonly named billing_plan_check or similar)
  BEGIN
    ALTER TABLE billing DROP CONSTRAINT IF EXISTS billing_plan_check;
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  
  -- Re-add check constraint including 'starter'
  BEGIN
    ALTER TABLE billing ADD CONSTRAINT billing_plan_check CHECK (plan IN ('commission', 'starter', 'startup', 'enterprise'));
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
END $$;
