import { headers } from 'next/headers';
import { geocodeVenueLocation } from './geocode-venue';

export interface BuyerGeo {
  latitude?: string;
  longitude?: string;
  country?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export async function getBuyerGeoApprox(): Promise<BuyerGeo> {
  const headersList = await headers();
  const latitude = headersList.get('x-vercel-ip-latitude') || undefined;
  const longitude = headersList.get('x-vercel-ip-longitude') || undefined;
  const country = headersList.get('x-vercel-ip-country') || undefined;
  
  const rawCity = headersList.get('x-vercel-ip-city') || undefined;
  let city = rawCity;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity);
    } catch {
      // Ignore decode error
    }
  }

  const geo: BuyerGeo = { latitude, longitude, country, city };

  // If we don't have city/zip but we have lat/lon, we could potentially reverse geocode.
  // For now, if vercel provides city, use it.
  
  return geo;
}
