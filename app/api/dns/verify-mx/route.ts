import { NextRequest, NextResponse } from "next/server";
import dns from "dns/promises";
import { isCurrentZavuInboundMx } from "@/lib/zavu-email-dns";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (
    !domain ||
    domain.length > 253 ||
    !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(domain)
  ) {
    return NextResponse.json({ success: false, error: "Valid domain is required" }, { status: 400 });
  }

  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS lookup timed out")), 5000)
      ),
    ]);
    const hasZavuMx = records.some((record) => isCurrentZavuInboundMx(record.exchange));
    return NextResponse.json({ success: true, verified: hasZavuMx, records });
  } catch (error) {
    return NextResponse.json({ success: false, verified: false, error: (error as Error).message });
  }
}
