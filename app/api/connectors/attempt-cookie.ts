import { z } from "zod"
import type { NextRequest, NextResponse } from "next/server"

const PREFIX = "mf_connector_"
const attemptSchema = z.object({ site_id: z.string().uuid(), nonce: z.string().regex(/^[a-f0-9]{64}$/), user_id: z.string().uuid() }).strict()
export type AttemptCookie = z.infer<typeof attemptSchema>

export function readAttemptCookie(request: NextRequest, id: string): AttemptCookie | null {
  if (!z.string().uuid().safeParse(id).success) return null
  try {
    const value = request.cookies.get(`${PREFIX}${id}`)?.value
    return value ? attemptSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8"))) : null
  } catch { return null }
}

export function setAttemptCookie(response: NextResponse, id: string, value: AttemptCookie) {
  response.cookies.set(`${PREFIX}${id}`, Buffer.from(JSON.stringify(value)).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/connectors", maxAge: 10 * 60,
  })
}

export function pendingAttemptIds(request: NextRequest): string[] {
  return request.cookies.getAll().map(cookie => cookie.name).filter(name => name.startsWith(PREFIX))
    .map(name => name.slice(PREFIX.length)).filter(id => z.string().uuid().safeParse(id).success).slice(0, 10)
}

export function clearAttemptCookie(response: NextResponse, id: string) {
  response.cookies.set(`${PREFIX}${id}`, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/connectors", maxAge: 0,
  })
}