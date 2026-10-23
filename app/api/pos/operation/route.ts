import { NextResponse } from "next/server";
import { executePosOperation } from "@/app/pos/operation-boundary";
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body";

const MAX_BODY_BYTES = 1024 * 1024;
const headers = {
  "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

/** Fixed same-origin HTTP transport, independent of the client Server Action queue. */
export async function POST(request: Request) {
  // Do not trust forwarding headers or accept sibling subdomains as same-origin.
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
    return NextResponse.json({ error: "Invalid POS operation request." }, {
      status: error instanceof RequestBodyTooLargeError ? 413 : 400, headers,
    });
  }
  const result = await executePosOperation(input);
  return NextResponse.json(result.body, { status: result.status, headers });
}