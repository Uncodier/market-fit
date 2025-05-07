# Secure Token System

This system provides a way to store sensitive tokens (like API keys, passwords, etc.) securely in the database using SHA-256 hashing.

## Key Features

- Tokens are stored using SHA-256 one-way hashing
- Uses salt for additional security
- Protects sensitive data like API keys, email passwords, etc.
- Token values cannot be retrieved, only verified against provided values

## How It Works

1. When storing a token, the system:
   - Generates a random salt
   - Hashes the token value with SHA-256 using the token + "Encryption-key" + salt
   - Stores both the salt and the hash in the database
   
2. When verifying a token, the system:
   - Retrieves the stored salt and hash
   - Hashes the provided token value with the same salt
   - Compares the computed hash with the stored hash
   - Returns true if they match, false otherwise

## API Endpoints

### `POST /api/secure-tokens`

Main endpoint for token operations with these operations:

#### Store a Token

```json
{
  "operation": "store",
  "siteId": "site-uuid",
  "tokenType": "email", // or "whatsapp", "api"
  "tokenValue": "secret-value-to-encrypt",
  "identifier": "user@example.com" // human-readable identifier
}
```

Response:
```json
{
  "success": true,
  "tokenId": "token-uuid" 
}
```

#### Verify a Token

```json
{
  "operation": "verify",
  "siteId": "site-uuid",
  "tokenType": "email",
  "tokenValue": "value-to-verify",
  "identifier": "user@example.com"
}
```

Response:
```json
{
  "isValid": true // or false
}
```

#### Check if a Token Exists

```json
{
  "operation": "check",
  "siteId": "site-uuid",
  "tokenType": "email",
  "identifier": "user@example.com"
}
```

Response:
```json
{
  "exists": true // or false
}
```

#### Delete a Token

```json
{
  "operation": "delete",
  "siteId": "site-uuid",
  "tokenType": "email",
  "identifier": "user@example.com"
}
```

Response:
```json
{
  "success": true
}
```

## Testing Endpoint

For development testing, use the `/api/test-token-encryption` endpoint with the same request format.

## Client API

Use the `secureTokensService` to work with secure tokens:

```typescript
import { secureTokensService } from '@/app/services/secure-tokens-service';

// Store token
const tokenId = await secureTokensService.storeToken(
  'site-id',
  'api',
  'secret-token',
  'token-name'
);

// Verify token
const isValid = await secureTokensService.verifyToken(
  'site-id',
  'api',
  'token-to-verify',
  'token-name'
);

// Check if token exists
const exists = await secureTokensService.hasToken(
  'site-id',
  'api',
  'token-name'
);

// Delete token
const deleted = await secureTokensService.deleteToken(
  'site-id',
  'api',
  'token-name'
);
```

## Security Considerations

- This system uses one-way hashing - original values cannot be retrieved
- Authentication is required for all operations that modify data
- Tokens are protected with row-level security in Supabase
- Each token is tied to a specific site ID for authorization 