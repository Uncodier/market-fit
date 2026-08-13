export type PosShippingAddress = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

export const EMPTY_POS_SHIPPING_ADDRESS: PosShippingAddress = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

export function isCompleteShippingAddress(
  addr?: PosShippingAddress | null,
): boolean {
  return Boolean(addr?.line1?.trim() && addr?.city?.trim() && addr?.zip?.trim());
}
