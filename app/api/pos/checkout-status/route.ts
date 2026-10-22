import { NextResponse } from "next/server";
import { decodeRequestBody, readLimitedRequestBody } from "@/lib/http/read-limited-request-body";
import { readPosCheckoutStatus } from "@/app/pos/checkout-status-boundary";

const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** Read-only recovery, outside Next's client Server Action mutation queue. */
export async function POST(request: Request) {
  let input: unknown;
  try {
    input = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 32_768)));
  } catch {
    return NextResponse.json({ error: "Invalid checkout recovery request." }, { status: 400, headers });
  }
  const result = await readPosCheckoutStatus(input);
  return NextResponse.json(result.body, { status: result.status, headers });
}