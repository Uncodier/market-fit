import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
  const etag = version ? `"${version}"` : undefined;
  const ifNoneMatch = request.headers.get("if-none-match");

  if (etag && (ifNoneMatch === etag || ifNoneMatch === version)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  }

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        ...(etag ? { ETag: etag } : {}),
      },
    }
  )
}
