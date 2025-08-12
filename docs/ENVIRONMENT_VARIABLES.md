# Environment Variables Configuration

This document describes all the required environment variables for the Market Fit application.

## Required Environment Variables

Create a `.env.local` file in the root of your project with the following variables:

### Core Application

```bash
# Application URL (required for redirects and webhooks)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# API Server URL (required for robot operations and external integrations)
# This should point to your external API server that handles robot orchestration
NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001
# Alternative fallback (same value as above)
API_SERVER_URL=http://localhost:3001
```

### Supabase Configuration

```bash
# Supabase Project Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Supabase Service Role (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Stripe Integration (Optional)

```bash
# Stripe Keys for payment processing
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs for subscriptions
STRIPE_STARTUP_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
```

### Twilio/WhatsApp Integration (Optional)

```bash
# Twilio credentials for WhatsApp integration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
```

### Google OAuth (Optional)

```bash
# Google OAuth credentials (configured via Supabase dashboard)
# No additional environment variables needed - configure in Supabase Auth settings
```

## Critical Variables

The following variables are **required** for the application to function properly:

1. **NEXT_PUBLIC_SUPABASE_URL** - Your Supabase project URL
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Your Supabase anonymous key
3. **NEXT_PUBLIC_API_SERVER_URL** - URL to your external API server for robot operations

## API Server URL

The `NEXT_PUBLIC_API_SERVER_URL` variable is crucial for robot operations. It should point to an external API server that handles:

- Robot start/stop operations (`/api/workflow/startRobot`, `/api/robots/instance/stop`)
- Workflow management
- Integration with external services

### Example Configurations

**Development:**
```bash
NEXT_PUBLIC_API_SERVER_URL=http://localhost:3001
```

**Production:**
```bash
NEXT_PUBLIC_API_SERVER_URL=https://api.your-domain.com
```

## Error Handling

If environment variables are not properly configured, you may see errors like:

- "API server URL is not configured" - Set `NEXT_PUBLIC_API_SERVER_URL`
- Authentication errors - Check Supabase configuration
- Payment errors - Verify Stripe keys

## Security Notes

- Never commit your `.env.local` file to version control
- Use different API keys for development and production
- Regularly rotate sensitive keys
- Ensure webhook URLs are properly secured in production

## Validation

To verify your environment variables are properly set:

1. Check the browser console for API server URL logs in development
2. Test robot operations to ensure API connectivity
3. Verify authentication flows work properly
4. Test any payment or integration features you're using
