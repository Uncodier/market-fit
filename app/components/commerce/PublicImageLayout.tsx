import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { publicImageDeliveryFromHeaders } from '@/app/lib/public-image-delivery'
import { PublicImageDelivery } from './PublicImageDelivery'

/** Resolve once on the server and serialize the public policy through the RSC payload. */
export async function PublicImageLayout({ children }: { children: ReactNode }) {
  const delivery = publicImageDeliveryFromHeaders(await headers())
  return <PublicImageDelivery delivery={delivery}>{children}</PublicImageDelivery>
}