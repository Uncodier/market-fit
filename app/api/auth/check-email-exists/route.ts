import { NextResponse } from 'next/server'

/** Retained for old clients without exposing account existence or auth providers. */
export async function POST() {
  return NextResponse.json({ accepted: true })
}