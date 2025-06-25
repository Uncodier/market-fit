import { createClient } from '@/lib/supabase/client'
import { loadStripe } from '@stripe/stripe-js'

// Stripe instance management
let stripePromise: Promise<any> | null = null;
let stripeInitializationError: string | null = null;

// Initialize Stripe only in the browser
const initializeStripe = () => {
  if (typeof window === 'undefined') {
    return null; // Server-side rendering
  }

  if (stripePromise) {
    return stripePromise; // Already initialized
  }

  if (stripeInitializationError) {
    console.error('Stripe initialization previously failed:', stripeInitializationError);
    return null;
  }

  try {
    const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    if (!stripeKey) {
      stripeInitializationError = 'Stripe publishable key is missing. Please add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to your .env.local file.';
      console.error(stripeInitializationError);
      return null;
    }
    
    if (!stripeKey.startsWith('pk_')) {
      stripeInitializationError = 'Invalid Stripe publishable key format. The key should start with "pk_test_" or "pk_live_".';
      console.error(stripeInitializationError);
      return null;
    }

    stripePromise = loadStripe(stripeKey)
      .then(stripe => {
        if (!stripe) {
          throw new Error('Failed to initialize Stripe SDK');
        }
        console.log('Stripe initialized successfully');
        return stripe;
      })
      .catch(error => {
        stripeInitializationError = `Failed to load Stripe.js: ${error.message}`;
        console.error(stripeInitializationError);
        stripePromise = null; // Reset so we can try again later
        return null;
      });

    return stripePromise;
  } catch (error) {
    stripeInitializationError = `Error during Stripe initialization: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(stripeInitializationError);
    return null;
  }
};

export interface BillingData {
  plan: 'commission' | 'startup' | 'enterprise'
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
   * Get Stripe instance with proper error handling
   */
  private async getStripe() {
    const stripePromise = initializeStripe();
    
    if (!stripePromise) {
      throw new Error(stripeInitializationError || 'Stripe is not available');
    }

    const stripe = await stripePromise;
    
    if (!stripe) {
      throw new Error('Failed to load Stripe. Please check your internet connection and try again.');
    }

    return stripe;
  }

  /**
   * Create or update payment method with Stripe and save billing info
   */
  async saveBillingInfo(siteId: string, billingData: BillingData): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient()
      
      // Only process card if we're on the client and have complete card information
      let stripeCustomerId = ''
      let stripePaymentMethodId = ''
      let maskedCardNumber = ''

      if (typeof window !== 'undefined' && billingData.card_number && billingData.card_expiry && billingData.card_cvc) {
        try {
          const stripe = await this.getStripe();

          // Get any existing billing info to check for Stripe customer ID
          const { data: existingBilling } = await supabase
            .from('billing')
            .select('stripe_customer_id')
            .eq('site_id', siteId)
            .single()

          // Create payment method in Stripe
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
        } catch (stripeError) {
          console.error('Stripe processing error:', stripeError);
          return { 
            success: false, 
            error: `Payment processing failed: ${stripeError instanceof Error ? stripeError.message : 'Unknown error'}`
          }
        }
      } else if (billingData.card_number) {
        // If not on client or don't have Stripe, but have card number,
        // mask it manually for storage
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
   * Create Stripe Checkout session for credits
   */
  async createCreditsCheckoutSession(
    siteId: string, 
    credits: number, 
    userEmail: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const response = await fetch('/api/stripe/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits,
          amount: credits === 20 ? 20 : credits === 52 ? 49.25 : 500,
          siteId,
          userEmail,
          successUrl: `${window.location.origin}/billing/success?credits=${credits}`,
          cancelUrl: `${window.location.origin}/checkout`,
        }),
      })

      const { url, error } = await response.json()

      if (error) {
        return { success: false, error }
      }

      return { success: true, url }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Create Stripe Checkout session for subscription
   */
  async createSubscriptionCheckoutSession(
    siteId: string,
    plan: 'startup' | 'enterprise',
    userEmail: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const response = await fetch('/api/stripe/checkout/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          siteId,
          userEmail,
          successUrl: `${window.location.origin}/billing/success?plan=${plan}`,
          cancelUrl: `${window.location.origin}/checkout`,
        }),
      })

      const { url, error } = await response.json()

      if (error) {
        return { success: false, error }
      }

      return { success: true, url }
    } catch (error) {
      console.error('Error creating subscription checkout:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }
}

export const billingService = new BillingService() 