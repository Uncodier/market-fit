-- IMPORTANT: Before running this migration, ensure you have set the 'app.encryption_key' 
-- parameter in your Supabase project settings.
-- Run this in the SQL editor first:
-- ALTER DATABASE "<your-database-name>" SET "app.encryption_key" TO '<strong-random-secret>';
-- The key will be used for encrypting and decrypting the token values.

-- Create secure tokens table for storing encrypted credentials
CREATE TABLE IF NOT EXISTS "secure_tokens" (
  "id" UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  "site_id" UUID REFERENCES "sites"("id") ON DELETE CASCADE,
  "token_type" TEXT NOT NULL,
  "encrypted_value" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "last_used" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE ("site_id", "token_type", "identifier")
);

-- Add comment to explain the token_type field
COMMENT ON COLUMN "secure_tokens"."token_type" IS 'Type of token: "email", "whatsapp", "api", etc.';

-- Add comment to explain the encrypted_value field
COMMENT ON COLUMN "secure_tokens"."encrypted_value" IS 'Encrypted token value';

-- Add comment to explain the identifier field
COMMENT ON COLUMN "secure_tokens"."identifier" IS 'Human-readable identifier for the token (e.g. email address)';

-- Add RLS policies
ALTER TABLE "secure_tokens" ENABLE ROW LEVEL SECURITY;

-- Policy for users to select their own tokens
CREATE POLICY "Users can view their own tokens" ON "secure_tokens"
  FOR SELECT
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Policy for users to insert their own tokens
CREATE POLICY "Users can insert their own tokens" ON "secure_tokens"
  FOR INSERT
  WITH CHECK (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Policy for users to update their own tokens
CREATE POLICY "Users can update their own tokens" ON "secure_tokens"
  FOR UPDATE
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Policy for users to delete their own tokens
CREATE POLICY "Users can delete their own tokens" ON "secure_tokens"
  FOR DELETE
  USING (
    site_id IN (
      SELECT id FROM sites WHERE user_id = auth.uid()
    )
  );

-- Create an encryption function
CREATE OR REPLACE FUNCTION encrypt_token(
  token_value TEXT,
  encryption_key TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  actual_key TEXT;
BEGIN
  -- Use provided key or fall back to an environment variable
  actual_key := COALESCE(encryption_key, current_setting('app.encryption_key', true));
  
  -- If no key is available, raise an exception
  IF actual_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key is not available';
  END IF;
  
  -- Return encrypted value using pgcrypto
  RETURN encode(
    pgp_sym_encrypt(
      token_value, 
      actual_key
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a decryption function
CREATE OR REPLACE FUNCTION decrypt_token(
  encrypted_value TEXT,
  encryption_key TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  actual_key TEXT;
BEGIN
  -- Use provided key or fall back to an environment variable
  actual_key := COALESCE(encryption_key, current_setting('app.encryption_key', true));
  
  -- If no key is available, raise an exception
  IF actual_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key is not available';
  END IF;
  
  -- Return decrypted value
  RETURN pgp_sym_decrypt(
    decode(encrypted_value, 'base64'),
    actual_key
  );
EXCEPTION
  WHEN others THEN
    RETURN NULL; -- Return NULL if decryption fails
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to store a token securely
CREATE OR REPLACE FUNCTION store_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_token_value TEXT,
  p_identifier TEXT,
  p_encryption_key TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  encrypted_token TEXT;
  token_id UUID;
BEGIN
  -- Encrypt the token
  encrypted_token := encrypt_token(p_token_value, p_encryption_key);
  
  -- Insert or update the token
  INSERT INTO secure_tokens (site_id, token_type, encrypted_value, identifier, updated_at)
  VALUES (p_site_id, p_token_type, encrypted_token, p_identifier, NOW())
  ON CONFLICT (site_id, token_type, identifier)
  DO UPDATE SET 
    encrypted_value = encrypted_token,
    updated_at = NOW()
  RETURNING id INTO token_id;
  
  RETURN token_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to retrieve a token securely
CREATE OR REPLACE FUNCTION get_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT,
  p_encryption_key TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  token_record RECORD;
  decrypted_value TEXT;
BEGIN
  -- Get the encrypted token
  SELECT * INTO token_record
  FROM secure_tokens
  WHERE site_id = p_site_id
    AND token_type = p_token_type
    AND identifier = p_identifier;
    
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Decrypt the token
  decrypted_value := decrypt_token(token_record.encrypted_value, p_encryption_key);
  
  -- Update last_used timestamp
  UPDATE secure_tokens
  SET last_used = NOW()
  WHERE id = token_record.id;
  
  RETURN decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to delete a token
CREATE OR REPLACE FUNCTION delete_secure_token(
  p_site_id UUID,
  p_token_type TEXT,
  p_identifier TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  DELETE FROM secure_tokens
  WHERE site_id = p_site_id
    AND token_type = p_token_type
    AND identifier = p_identifier
  RETURNING 1 INTO rows_affected;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 