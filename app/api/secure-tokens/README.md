# Secure Tokens API

`POST /api/secure-tokens` stores retrievable integration credentials for a site.
Despite the historical name, values are encrypted with CryptoJS AES; they are
not one-way hashes.

## Authorization

Every operation requires an authenticated site member through
`requireSiteAccess()`:

- `store`, `retrieve`, and `delete` require site owner/admin access.
- `verify` and `check` require site membership.

The route uses a service-role Supabase client only after this check. Preserve
the authorization order when modifying it.

## Operations

Requests contain `operation`, `siteId`, `tokenType`, and, where applicable,
`identifier` and `tokenValue`.

- `store` — encrypt and insert or replace a credential.
- `retrieve` — decrypt and return a credential to an authorized manager.
- `verify` — compare supplied plaintext with the decrypted value.
- `check` — report whether a matching row exists.
- `delete` — remove a matching credential.

Because `retrieve` returns plaintext, callers and responses must be treated as
secret-bearing. Never log response bodies or expose this route through public
UI state.

## Encryption configuration

```dotenv
ENCRYPTION_KEY=
LEGACY_ENCRYPTION_KEY=
```

The current implementation retains a literal fallback for compatibility. This
is security debt, not an approved deployment default:

- production must set a strong `ENCRYPTION_KEY`;
- `LEGACY_ENCRYPTION_KEY` should exist only while old ciphertext requires it;
- key rotation requires decrypting and re-encrypting stored values;
- removing or changing a key without migration can make credentials
  unrecoverable.

Prefer a managed secret store or authenticated encryption for future redesigns.
Do not describe the current ciphertext as hashing, irreversible storage, or
tamper-authenticated encryption.

## Maintenance checklist

- Keep all cryptography and service-role operations server-only.
- Validate bounded `tokenType`, `identifier`, and request sizes.
- Do not return raw database or cryptographic errors.
- Test unauthenticated, non-member, ordinary-member, manager, and cross-site
  access for every operation.
- Test key rotation and legacy decryption before changing key handling.
- Redact token values, ciphertext, keys, and authorization headers from logs.
