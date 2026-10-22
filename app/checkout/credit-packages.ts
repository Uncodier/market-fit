export interface CreditPackage {
  credits: number
  price: number
  pricePerCredit: number
  discountKey?: string
  popular?: boolean
}

// Display packages only; the checkout endpoint validates server-owned prices.
export const creditPackages: CreditPackage[] = [
  { credits: 20, price: 20, pricePerCredit: 1.00 },
  {
    credits: 52,
    price: 49.25,
    pricePerCredit: 0.95,
    discountKey: "commercePages.checkout.discount1_5",
    popular: true,
  },
  {
    credits: 515,
    price: 500,
    pricePerCredit: 0.97,
    discountKey: "commercePages.checkout.discount3",
  },
]