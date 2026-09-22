import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import { isCurrentZavuInboundMx } from "@/lib/zavu-email-dns";
import { getCachedJson, setCachedJson } from "@/lib/redis/control-plane";
import {
  normalizedRequestCacheKey,
  readThroughJsonCache,
} from "@/lib/redis/json-cache";

const POSITIVE_DNS_CACHE_TTL_SECONDS = 300;
const NEGATIVE_DNS_CACHE_TTL_SECONDS = 60;
const DNS_CACHE_LOCK_TTL_MS = 6_000;

type DnsSuccessResponse = {
  success: true;
  verified: boolean;
  records: Awaited<ReturnType<typeof dns.resolveMx>>;
};

type DnsNegativeResponse = {
  success: false;
  verified: false;
  error: string;
};

type DnsCacheValue = DnsSuccessResponse | DnsNegativeResponse;

function isCacheableDnsMiss(error: unknown): error is NodeJS.ErrnoException {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENODATA" || code === "ENOTFOUND";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "DNS lookup failed";
}

async function resolveMxWithTimeout(domain: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("DNS lookup timed out")),
          5000
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  const requestedDomain = req.nextUrl.searchParams.get("domain");
  if (
    !requestedDomain ||
    requestedDomain.length > 253 ||
    !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(requestedDomain)
  ) {
    return NextResponse.json({ success: false, error: "Valid domain is required" }, { status: 400 });
  }

  try {
    const domain = requestedDomain.toLowerCase();
    const cacheUrl = new URL("https://cache.local");
    cacheUrl.searchParams.set("domain", domain);
    const cacheKey = await normalizedRequestCacheKey(
      "provider:dns:verify-mx",
      new Request(cacheUrl)
    );
    const positiveCacheKey = `${cacheKey}:positive`;
    const positive = await getCachedJson<DnsSuccessResponse>(positiveCacheKey);
    if (positive) return NextResponse.json(positive);

    const cached = await readThroughJsonCache<DnsCacheValue>({
      key: `${cacheKey}:lookup`,
      ttlSeconds: NEGATIVE_DNS_CACHE_TTL_SECONDS,
      lockTtlMs: DNS_CACHE_LOCK_TTL_MS,
      compute: async () => {
        try {
          const records = await resolveMxWithTimeout(domain);
          const value: DnsSuccessResponse = {
            success: true,
            verified: records.some((record) =>
              isCurrentZavuInboundMx(record.exchange)
            ),
            records,
          };
          if (value.verified) {
            await setCachedJson(
              positiveCacheKey,
              value,
              POSITIVE_DNS_CACHE_TTL_SECONDS
            );
          }
          return value;
        } catch (error) {
          if (!isCacheableDnsMiss(error)) throw error;
          return {
            success: false,
            verified: false,
            error: errorMessage(error),
          };
        }
      },
    });

    if (cached.status === "busy") {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: "DNS verification is being refreshed",
        },
        { status: 503, headers: { "Retry-After": "2" } }
      );
    }
    return NextResponse.json(cached.value);
  } catch (error) {
    return NextResponse.json({
      success: false,
      verified: false,
      error: errorMessage(error),
    });
  }
}
