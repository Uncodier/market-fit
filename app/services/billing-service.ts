import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'

// Cargamos Stripe de forma condicional
let stripePromise: Promise<any> | null = null;

// Solo inicializamos Stripe en el cliente, no en el servidor
if (typeof window !== 'undefined') {
  try {
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripeKey) {
      console.error('Stripe publishable key is missing. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env.local file.');
    } else if (!stripeKey.startsWith('pk_')) {
      console.error('Invalid Stripe publishable key format. The key should start with "pk_test_" or "pk_live_".');
    } else {
      stripePromise = loadStripe(stripeKey)
        .catch(error => {
          console.error('Failed to initialize Stripe:', error);
          return null;
        });
    }
  } catch (error) {
    console.error('Error initializing Stripe:', error);
  }
}

export interface BillingData {
  plan: 'free' | 'starter' | 'professional' | 'enterprise'
  card_name?: string
  card_number?: string
  card_expiry?: string
  card_cvc?: string
  card_address?: string
  card_city?: string
  card_postal_code?: string
  card_country?: string
  tax_id?: string
  billing_address?: string
  billing_city?: string
  billing_postal_code?: string
  billing_country?: string
  auto_renew?: boolean
  credits_available?: number
}

class BillingService {
  /**
   * Create or update payment method with Stripe and save billing info
   */
  async saveBillingInfo(siteId: string, billingData: BillingData): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient()
      
      // Solo procesamos la tarjeta si estamos en el cliente y tenemos la información completa
      let stripeCustomerId = ''
      let stripePaymentMethodId = ''
      let maskedCardNumber = ''

      if (typeof window !== 'undefined' && stripePromise && billingData.card_number && billingData.card_expiry && billingData.card_cvc) {
        const stripe = await stripePromise

        if (!stripe) {
          console.error('Stripe failed to initialize. Please check if your Stripe publishable key is correct.');
          return { success: false, error: 'Payment service unavailable. Please check your configuration or try again later.' }
        }

        // Get any existing billing info to check for Stripe customer ID
        const { data: existingBilling } = await supabase
          .from('billing')
          .select('stripe_customer_id')
          .eq('site_id', siteId)
          .single()

        // If we have sensitive card info, create a payment method in Stripe
        const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
          type: 'card',
          card: {
            number: billingData.card_number,
            exp_month: parseInt(billingData.card_expiry.split('/')[0]),
            exp_year: parseInt(billingData.card_expiry.split('/')[1]),
            cvc: billingData.card_cvc,
          },
          billing_details: {
            name: billingData.card_name,
            address: {
              line1: billingData.card_address,
              city: billingData.card_city,
              postal_code: billingData.card_postal_code,
              country: billingData.card_country,
            },
          },
        })

        if (stripeError) {
          return { success: false, error: stripeError.message }
        }

        if (paymentMethod) {
          stripePaymentMethodId = paymentMethod.id

          // Create or get Stripe customer
          if (existingBilling?.stripe_customer_id) {
            stripeCustomerId = existingBilling.stripe_customer_id
            
            // Attach payment method to existing customer
            await stripe.paymentMethods.attach(paymentMethod.id, {
              customer: stripeCustomerId,
            })
          } else {
            // Create new customer with payment method
            const { customer } = await stripe.customers.create({
              payment_method: paymentMethod.id,
              name: billingData.card_name,
              email: (await supabase.auth.getUser()).data.user?.email,
            })
            
            if (customer) {
              stripeCustomerId = customer.id
            }
          }

          // Mask the card number for storage (••••••••••••1234)
          const last4 = paymentMethod.card?.last4 || billingData.card_number.slice(-4)
          maskedCardNumber = `•••• •••• •••• ${last4}`
        }
      } else if (billingData.card_number) {
        // Si no estamos en el cliente o no tenemos Stripe, pero hay un número de tarjeta,
        // enmascararlo manualmente para almacenamiento
        const last4 = billingData.card_number.slice(-4);
        maskedCardNumber = `•••• •••• •••• ${last4}`;
      }

      // Call the upsert_billing function
      const { data, error } = await supabase.rpc('upsert_billing', {
        p_site_id: siteId,
        p_plan: billingData.plan,
        p_card_name: billingData.card_name,
        p_masked_card_number: maskedCardNumber || null,
        p_card_expiry: billingData.card_expiry,
        p_stripe_customer_id: stripeCustomerId || null,
        p_stripe_payment_method_id: stripePaymentMethodId || null,
        p_card_address: billingData.card_address,
        p_card_city: billingData.card_city,
        p_card_postal_code: billingData.card_postal_code,
        p_card_country: billingData.card_country,
        p_tax_id: billingData.tax_id,
        p_billing_address: billingData.billing_address,
        p_billing_city: billingData.billing_city,
        p_billing_postal_code: billingData.billing_postal_code,
        p_billing_country: billingData.billing_country,
        p_auto_renew: billingData.auto_renew !== undefined ? billingData.auto_renew : true,
        p_credits_available: billingData.credits_available || 0
      })

      if (error) {
        console.error('Error saving billing info:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Billing service error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Get billing information for a site
   */
  async getBillingInfo(siteId: string): Promise<{ data: any; error: any }> {
    try {
      const supabase = createClient()
      return await supabase
        .from('billing')
        .select('*')
        .eq('site_id', siteId)
        .single()
    } catch (error) {
      console.error('Error getting billing info:', error)
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Purchase additional credits
   */
  async purchaseCredits(siteId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Implementation would go here
      // This would typically create a checkout session with Stripe
      return { success: true }
    } catch (error) {
      console.error('Error purchasing credits:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

export const billingService = new BillingService() 