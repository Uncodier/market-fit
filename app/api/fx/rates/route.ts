import { NextResponse } from 'next/server';

let cachedRates: { base: string; rates: Record<string, number>; date: string } | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  const now = Date.now();

  if (cachedRates && (now - lastFetchTime) < CACHE_TTL_MS) {
    return NextResponse.json(cachedRates, {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  }

  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', {
      next: { revalidate: 21600 },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from Frankfurter');
    }

    const data = await response.json();
    cachedRates = {
      base: data.base || 'USD',
      rates: data.rates || {},
      date: data.date,
    };
    lastFetchTime = now;

    return NextResponse.json(cachedRates, {
      headers: {
        'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[fx/rates] Error fetching exchange rates:', error);
    // Return last known good rates if available, else empty so UI can fallback
    return NextResponse.json(
      cachedRates || { base: 'USD', rates: {}, date: new Date().toISOString().split('T')[0] },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  }
}
