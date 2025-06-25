# Stripe Environment Variables Configuration

## Required Environment Variables

For Stripe to work correctly in this application, you need to set the following environment variables:

### 1. Stripe Secret Key (Server-side)
```bash
STRIPE_SECRET_KEY=sk_test_...  # For test environment
# OR
STRIPE_SECRET_KEY=sk_live_...  # For production environment
```

**Important:** 
- This key should NEVER be exposed to the client-side
- Must start with `sk_test_` (test) or `sk_live_` (production)
- Used for server-side operations like creating checkout sessions

### 2. Stripe Publishable Key (Client-side)
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # For test environment
# OR
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # For production environment
```

**Important:**
- This key is exposed to the client-side (hence the `NEXT_PUBLIC_` prefix)
- Must start with `pk_test_` (test) or `pk_live_` (production)
- Used for client-side Stripe operations

## Configuration Files

### Local Development (.env.local)
```bash
STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
```

### Production
Make sure both variables are configured in your hosting platform:
- Vercel: Project Settings > Environment Variables
- Netlify: Site Settings > Environment Variables
- Other platforms: Check their specific documentation

## Common Issues and Solutions

### "Missing required information" error on first click
This usually happens when:
1. User is not logged in
2. No site is selected
3. Package selection failed

**Solution:** The error messages are now more specific to help identify the exact issue.

### "Payment service configuration error" 
This happens when:
1. `STRIPE_SECRET_KEY` is not set
2. `STRIPE_SECRET_KEY` has wrong format (doesn't start with `sk_`)

**Solution:** 
1. Check that `STRIPE_SECRET_KEY` is properly set in your environment
2. Verify the key format is correct
3. Restart your application after setting environment variables

### Stripe initialization errors
This happens when:
1. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not set
2. Key has wrong format (doesn't start with `pk_`)

**Solution:**
1. Check that `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is properly set
2. Verify the key format is correct
3. Restart your application after setting environment variables

## Testing

### Verify Environment Variables
1. Check server-side: Look for console logs showing Stripe configuration errors
2. Check client-side: Open browser developer tools and look for Stripe initialization messages

### Test Checkout Flow
1. Ensure you're logged in
2. Select a site
3. Navigate to billing page
4. Try purchasing credits
5. Check console for detailed error messages

## Security Notes

1. Never commit real Stripe keys to version control
2. Use test keys for development and testing
3. Only use live keys in production
4. Rotate keys regularly for security
5. Monitor Stripe dashboard for unusual activity

## Getting Stripe Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Navigate to "Developers" > "API Keys"
3. Copy the Publishable key (starts with `pk_`)
4. Reveal and copy the Secret key (starts with `sk_`)
5. For production, toggle to "View live data" first

## Debugging Checklist

- [ ] Environment variables are set correctly
- [ ] Keys have correct format (pk_* and sk_*)
- [ ] Application restarted after setting variables
- [ ] User is logged in
- [ ] Site is selected
- [ ] Network connection is stable
- [ ] Stripe dashboard shows no issues 