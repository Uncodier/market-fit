import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/http/is-same-origin-request";
import { executePosOperation } from "@/app/pos/operation-boundary";
import { withPosServerTiming } from "@/app/pos/checkout-server-timing";
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body";

const MAX_BODY_BYTES = 1024 * 1024;
const headers = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

/** Fixed same-origin HTTP transport, independent of the client Server Action queue. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden POS request origin." }, { status: 403, headers });
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return NextResponse.json({ error: "Expected a JSON POS request." }, { status: 415, headers });
  }
  let input: unknown;
  try {
    input = JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, MAX_BODY_BYTES)));
  } catch (error) {
    return NextResponse.json({ error: "Invalid POS operation request." }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers,
    });
  }
  const { value: result, serverTiming } = await withPosServerTiming(() => executePosOperation(input));
  return NextResponse.json(result.body, { status: result.status, headers: { ...headers, "Server-Timing": serverTiming } });
}