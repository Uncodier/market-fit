import 'server-only'
import type Stripe from 'stripe'
import type { CreditPackage } from '@/lib/credit-packages'
import { createCreditsIdempotencyKey } from './idempotency'

function isStripeResourceError(error: unknown, code: string, status: number): boolean {
  return typeof error === 'object' && error !== null &&
    'type' in error && error.type === 'StripeInvalidRequestError' &&
    'code' in error && error.code === code &&
    'statusCode' in error && error.statusCode === status
}

function requireActiveProduct(
  product: Stripe.Product | Stripe.DeletedProduct,
  id: string,
  credits: number,
  checkOwnership: boolean
): string {
  if (product.id !== id || product.deleted || !('active' in product) || product.active !== true) {
    throw new Error('Credit package product is unavailable')
  }
  if (checkOwnership &&
    (product.metadata?.type !== 'credits_purchase' || product.metadata.credits !== String(credits))) {
    throw new Error('Credit package product ownership mismatch')
  }
  return product.id
}

/** Call only after checkout input and site-manager authorization have succeeded. */
export async function resolveCreditsProduct(
  stripe: Pick<Stripe, 'products'>,
  creditPackage: CreditPackage
): Promise<string> {
  // Existing operator-managed Products are never silently replaced or recreated.
  const configuredId = process.env[`STRIPE_CREDITS_${creditPackage.credits}_PRODUCT_ID`]
  const productId = configuredId ?? `prod_makinari_credits_${creditPackage.credits}`
  if (!/^[a-zA-Z0-9_-]{1,255}$/.test(productId)) {
    throw new Error('Invalid credit package product configuration')
  }
  const validateProduct = (product: Stripe.Product | Stripe.DeletedProduct) =>
    requireActiveProduct(product, productId, creditPackage.credits, configuredId === undefined)

  try {
    return validateProduct(await stripe.products.retrieve(productId))
  } catch (error) {
    if (configuredId !== undefined || !isStripeResourceError(error, 'resource_missing', 404)) {
      throw error
    }
  }

  const params: Stripe.ProductCreateParams = {
    id: productId,
    active: true,
    name: `${creditPackage.credits} Credits Package`,
    description: `Purchase ${creditPackage.credits} credits for your Uncodie account`,
    metadata: { type: 'credits_purchase', credits: String(creditPackage.credits) },
  }
  try {
    const product = await stripe.products.create(params, {
      idempotencyKey: createCreditsIdempotencyKey('product', params),
    })
    return validateProduct(product)
  } catch (error) {
    // A concurrent authorized checkout can win creation of the same fixed ID.
    if (!isStripeResourceError(error, 'resource_already_exists', 400)) throw error
    return validateProduct(await stripe.products.retrieve(productId))
  }
}