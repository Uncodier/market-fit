# Secure Tokens Migration

## Overview

This migration adds a `secure_tokens` table to the database with encryption capabilities for storing sensitive credentials like email passwords and API tokens.

## Required Setup Before Migration

Before running the migration, you must set an encryption key as a database parameter:

1. Connect to the Supabase SQL editor
2. Run the following SQL command:

```sql
ALTER DATABASE "<your-database-name>" SET "app.encryption_key" TO '<strong-random-secret>';
```

Replace:
- `<your-database-name>` with your actual database name
- `<strong-random-secret>` with a strong random secret key (at least 16 characters recommended)

## Important Security Notes

- Keep your encryption key secure and never commit it to version control
- If you change the encryption key, existing encrypted values will not be decryptable
- For production environments, consider using a key management service
- The encryption is performed using pgcrypto's symmetric encryption (PGP)

## Functions Provided

The migration creates several functions to manage secure tokens:

- `encrypt_token(token_value, encryption_key)`: Encrypts a token value
- `decrypt_token(encrypted_value, encryption_key)`: Decrypts a token value
- `store_secure_token(site_id, token_type, token_value, identifier)`: Stores a token securely
- `get_secure_token(site_id, token_type, identifier)`: Retrieves a decrypted token
- `delete_secure_token(site_id, token_type, identifier)`: Deletes a stored token

## Usage in Application

The application interfaces with these database functions through the `secureTokensService` which provides a simple API for managing tokens. 