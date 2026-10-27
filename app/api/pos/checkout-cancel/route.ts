import { NextResponse } from "next/server";
import { cancelPosCheckout } from "@/app/pos/checkout-cancel-boundary";
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body";

const MAX_BODY_BYTES = 32_768;
const headers = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

/** Cancels admission only, never an order or a recorded payment. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin || (fetchSite && fetchSite !== "same-origin")) {
    return NextResponse.json({ error: "Forbidden POS request origin." }, { status: 403, headers });
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Expected a JSON POS request." }, { status: 415, headers });
  }
  let input: unknown;
  try {
    input = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, MAX_BODY_BYTES)));
  } catch (error) {
    return NextResponse.json({ error: "Invalid checkout cancellation request." }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers,
    });
  }
  const result = await cancelPosCheckout(input);
  return NextResponse.json(result.body, { status: result.status, headers });
}