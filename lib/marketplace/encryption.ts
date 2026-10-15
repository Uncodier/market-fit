import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { marketplaceCredentialsSchema, type MarketplaceCredentials } from "./config-types"

function encryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key?.trim()) throw new Error("Marketplace encryption is not configured")
  return createHash("sha256").update(key, "utf8").digest()
}

/** Native site_secrets envelope. No legacy/fallback key is accepted. */
export function encryptMarketplaceCredentials(credentials: MarketplaceCredentials): string {
  return encryptMarketplacePayload(marketplaceCredentialsSchema.parse(credentials))
}

/** Shared authenticated envelope for server-owned OAuth contexts and tokens. */
export function encryptMarketplacePayload(value: unknown): string {
  const plaintext = JSON.stringify(value)
  if (!plaintext || Buffer.byteLength(plaintext) > 200_000) throw new Error("Marketplace payload exceeds the limit")
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":")
}

export function decryptMarketplaceCredentials(envelope: string): MarketplaceCredentials {
  try { return marketplaceCredentialsSchema.parse(decryptMarketplacePayload(envelope)) }
  catch { throw new Error("Marketplace credentials are unavailable") }
}

export function decryptMarketplacePayload(envelope: string): unknown {
  try {
    const key = encryptionKey()
    const [version, ivText, tagText, ciphertextText, extra] = envelope.split(":")
    if (version !== "v1" || extra !== undefined || !ivText || !tagText || !ciphertextText) throw new Error()
    const decode = (value: string) => {
      const decoded = Buffer.from(value, "base64")
      if (decoded.toString("base64") !== value) throw new Error()
      return decoded
    }
    const iv = decode(ivText)
    const tag = decode(tagText)
    const ciphertext = decode(ciphertextText)
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length > 200_000) throw new Error()
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    return JSON.parse(plaintext) as unknown
  } catch {
    // Never surface crypto, parsing or validation errors containing secret material.
    throw new Error("Marketplace credentials are unavailable")
  }
}