import {
  generatePublicAccessToken,
  getPublicAccessTokenExpiresAt,
  isPublicAccessTokenActive,
  isValidPublicAccessToken,
} from "@/app/documents/public-token"

const TOKEN_SELECT =
  "id, public_access_token, public_access_token_expires_at, public_access_token_revoked_at"

export type PublicAccessTokenRow = {
  id: string
  public_access_token?: string | null
  public_access_token_expires_at?: string | null
  public_access_token_revoked_at?: string | null
}

export type PublicAccessTokenResult = {
  token?: string
  expiresAt?: string | null
  error?: string
}

async function loadTokenRow(
  client: any,
  table: string,
  id: string
): Promise<{ row: PublicAccessTokenRow | null; error?: string }> {
  const { data, error } = await client
    .from(table)
    .select(TOKEN_SELECT)
    .eq("id", id)
    .single()

  return {
    row: (data as PublicAccessTokenRow | null) || null,
    error: error?.message,
  }
}

function matchObservedValue(query: any, column: string, value: string | null | undefined) {
  return value == null ? query.is(column, null) : query.eq(column, value)
}

export async function ensurePublicAccessTokenForRecord(
  client: any,
  table: string,
  id: string,
  options: { rotate?: boolean; now?: Date } = {}
): Promise<PublicAccessTokenResult> {
  const initial = await loadTokenRow(client, table, id)
  if (!initial.row) return { error: initial.error || "Document not found" }

  if (
    !options.rotate &&
    isValidPublicAccessToken(initial.row.public_access_token) &&
    isPublicAccessTokenActive(initial.row, options.now)
  ) {
    return {
      token: initial.row.public_access_token as string,
      expiresAt: initial.row.public_access_token_expires_at || null,
    }
  }

  const token = generatePublicAccessToken()
  const expiresAt = getPublicAccessTokenExpiresAt(options.now)
  let update = client
    .from(table)
    .update({
      public_access_token: token,
      public_access_token_expires_at: expiresAt,
      public_access_token_revoked_at: null,
    })
    .eq("id", id)

  update = matchObservedValue(
    update,
    "public_access_token",
    initial.row.public_access_token
  )
  update = matchObservedValue(
    update,
    "public_access_token_expires_at",
    initial.row.public_access_token_expires_at
  )
  update = matchObservedValue(
    update,
    "public_access_token_revoked_at",
    initial.row.public_access_token_revoked_at
  )

  const { data: updated, error: updateError } = await update
    .select(TOKEN_SELECT)
    .maybeSingle()

  if (updateError) return { error: updateError.message }
  if (updated?.public_access_token) {
    return {
      token: updated.public_access_token,
      expiresAt: updated.public_access_token_expires_at || expiresAt,
    }
  }

  // Another request won the compare-and-set. Return its active token.
  const winner = await loadTokenRow(client, table, id)
  if (
    winner.row &&
    isValidPublicAccessToken(winner.row.public_access_token) &&
    isPublicAccessTokenActive(winner.row, options.now)
  ) {
    return {
      token: winner.row.public_access_token as string,
      expiresAt: winner.row.public_access_token_expires_at || null,
    }
  }

  return { error: winner.error || "Failed to create public link" }
}

export async function revokePublicAccessTokenForRecord(
  client: any,
  table: string,
  id: string,
  now = new Date()
) {
  const revokedAt = now.toISOString()
  const { data, error } = await client
    .from(table)
    .update({ public_access_token_revoked_at: revokedAt })
    .eq("id", id)
    .select(TOKEN_SELECT)
    .single()

  if (error || !data) {
    return { error: error?.message || "Document not found" }
  }
  return { success: true as const, revokedAt }
}
