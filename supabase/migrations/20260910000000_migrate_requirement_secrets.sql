-- Migrate existing requirement secrets from secure_tokens to site_secrets
INSERT INTO public.site_secrets (id, site_id, name, provider, use_case, encrypted_value)
SELECT id, site_id, identifier, 'custom', identifier, encrypted_value
FROM public.secure_tokens
WHERE token_type = 'custom_secret'
ON CONFLICT (site_id, provider, use_case) WHERE instance_id IS NULL DO NOTHING;
