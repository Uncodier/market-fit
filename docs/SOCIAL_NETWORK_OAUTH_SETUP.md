# Social Network OAuth Setup Guide

This guide explains how to configure OAuth for social networks using the outstand.so API.

**Important:** Outstand.so uses a Bring Your Own Key (BYOK) model. The OAuth credentials (client_key and client_secret) are already configured in outstand.so's system. You don't need to configure them yourself - you only need to:
1. Ensure your `redirect_uri` is whitelisted in outstand.so
2. Call the auth-url endpoint to get the OAuth URL
3. Handle the callback: **Outstand** redirects to your `redirect_uri` with `?session=xxx` (success) or `?error=...` (failure); you then call pending + finalize

## 3-leg OAuth for Facebook and LinkedIn

**Outstand (support):** *"Facebook (and LinkedIn) requires a 3-leg auth flow. **The callback url lies on your app**, and then you call the finalization API endpoint."*  
Docs: [Facebook — White-labeling authentication flow](https://www.outstand.so/docs/configurations/facebook#white-labeling-authentication-flow)

**What that means:**
- **"The callback url lies on your app"** = the URL where the user lands after the OAuth flow is **ours** (e.g. `/api/social/callback/facebook`). **Outstand** redirects to that URL with `?session=xxx` or `?error=...`. **Facebook does not redirect to us** — Facebook redirects to Outstand; Outstand then redirects to **our** callback. So the “callback” that “lies on your app” is the one **Outstand** calls, not Facebook.
- **"You call the finalization API endpoint"** = after we receive `session`, we call `GET /v1/social-accounts/pending/:sessionToken` and `POST .../finalize`. We do that.

Their doc also says: *"We will redirect to it with a session query parameter"* — "it" = the `redirect_uri` we send in the auth-url request; "We" = **Outstand**. So only Outstand hits our callback; Facebook never does.

For **Facebook** and **LinkedIn** we use the 3-leg (white-label) flow:
1. We call auth-url with `redirect_uri` = our callback (`/api/social/callback/facebook`).
2. User → **Outstand** URL → Outstand → **Facebook** (the `redirect_uri` in the Facebook dialog is **Outstand's**).
3. **Facebook** → **Outstand** with `code` and `state`. So **Valid OAuth Redirect URIs** in Facebook = **Outstand's** URL (`https://www.outstand.so/app/api/socials/facebook/callback`), **not** ours.
4. **Outstand** → **our** `redirect_uri` with `?session=xxx` (success) or `?error=...` (failure).
5. We go to `/settings/social_network?session=...`, then call pending + finalize.

**In Facebook/LinkedIn:** add **Outstand's** callback to Valid OAuth Redirect URIs. **Our** URL is only for Outstand→us; it does **not** go in Facebook.

**Why does the Facebook OAuth dialog show `redirect_uri=outstand.so` and not our URL?**  
Because **Facebook talks to Outstand**. Our `redirect_uri` is in the **Outstand** auth_url (the first URL we open: `.../outstand.so/.../facebook/...?redirect_uri=OUR_URL&tenant_id=...`). Outstand uses it only to send the user to us *after* they receive the `code` from Facebook. So: Facebook → Outstand (with code) → **Outstand** redirects to **our** URL with `?session=...` or `?error=...`. No change is needed.

---

### Match with Outstand auth-url API doc

The **Get social network authentication URL** ([auth-url](https://www.outstand.so/docs)) workflow and parameters align as follows:

| Outstand doc | What we do |
|--------------|------------|
| Call this endpoint to get the authentication URL (optionally include `tenant_id`) | We POST to `/v1/social-networks/:network/auth-url` with `{ redirect_uri, tenant_id }` (we use `siteId` as `tenant_id`). |
| Redirect the user to the returned `auth_url` | `window.location.href = result.data.auth_url` (Outstand URL with our `redirect_uri` and `tenant_id` in query). |
| The user will authenticate on the social network's platform | User goes to Outstand URL → Outstand → Facebook → user authorizes. |
| **The user will be redirected back to your specified `redirect_uri` (or default)** | **Outstand** redirects the user to our `redirect_uri` with `?session=xxx` or `?error=...`. Facebook redirects to Outstand, not to us; then Outstand sends the user to our URL. |
| Handle the OAuth callback to complete the account connection | Our `/api/social/callback/:network` receives `session` or `error`; we redirect to `/settings/social_network`, then call `GET /v1/social-accounts/pending/:session` and `POST .../finalize`. |
| **Redirect URI:** *"must match one of the authorized redirect URIs configured in your OAuth application on the social network's developer portal"* | For **Facebook/LinkedIn white-label**: the URL in **Facebook’s** “Valid OAuth Redirect URIs” is **Outstand’s** callback (Facebook redirects to Outstand). **Our** `redirect_uri` is not in Facebook; it must be **whitelisted in Outstand** so they can redirect the user to us. |
| **Tenant ID:** associate the connected account with a tenant | We send `tenant_id: siteId`. |
| *"For white-label users, this endpoint guarantees your customers never see our branding"* | The user ends on **our** app (`/api/social/callback/...` → `/settings/social_network`), not on an Outstand-branded success page. |

## ⚠️ Development vs Production

**For Development:**
- OAuth providers (Facebook, etc.) **do not allow `localhost`** as a redirect URI
- The code automatically uses your production domain (`app.makinari.com`) as the `redirect_uri` when running on localhost
- In 3-leg, **Outstand** redirects to your callback (production or tunnel) with `?session=xxx` or `?error=...`. The `returnTo` on the selection page can send the user back to localhost if needed.

**Requirements for Testing:**
1. ✅ Your production domain (`app.makinari.com`) must be deployed with the callback page (`/settings/social_network`)
2. ✅ Outstand.so must whitelist your `redirect_uri` pattern
3. ✅ Outstand.so must correctly process the Facebook OAuth callback

**Alternative for Local Development (tunnel):**  
Use Cloudflare Tunnel (o similar) y las variables de túnel para que los redirects vuelvan al túnel en lugar de `app.makinari.com`.

En `.env.local`:
```bash
# URL pública del túnel (p. ej. cloudflared: https://xxx.trycloudflare.com)
# - SSH_TUNNEL_URL: usada en el callback (servidor)
# - NEXT_PUBLIC_SSH_TUNNEL_URL: usada en SocialSection (cliente; en Next.js debe ser NEXT_PUBLIC_ para exponerla)
# Puedes definir solo NEXT_PUBLIC_SSH_TUNNEL_URL y servirá en ambos si el callback lee NEXT_PUBLIC_SSH_TUNNEL_URL.
SSH_TUNNEL_URL=https://fluid-forget-implementing-toxic.trycloudflare.com
NEXT_PUBLIC_SSH_TUNNEL_URL=https://fluid-forget-implementing-toxic.trycloudflare.com
```

En 3-leg, **Outstand** redirige a nuestra app con `?session=xxx` o `?error=...`. Esa URL nuestra (o la del túnel) es la que pasamos como `redirect_uri` al pedir el auth-url. En **Facebook** (Valid OAuth Redirect URIs) debe estar la URL de **Outstand** (`https://www.outstand.so/app/api/socials/facebook/callback`), no la nuestra; Facebook solo habla con Outstand.

## Supabase: URL Configuration (evitar pérdida de sesión al volver de Outstand)

Cuando Outstand redirige al usuario a nuestra app (`/api/social/callback/facebook` → `/settings/social_network`), la petición viene de un **redirect cross-site** (outstand.so → app.makinari.com). Si Supabase no tiene bien configuradas las URLs, puede **invalidar o no reconocer la sesión** al aterrizar en esas rutas. Configura lo siguiente en **Supabase Dashboard → Authentication → URL Configuration**:

### Site URL

- Debe ser la URL **exacta** de producción, sin barra final: `https://app.makinari.com`
- Si usas `http://`, otro dominio (p. ej. `www.`) o una barra final, la cookie puede quedar con dominio/path incorrectos y no enviarse al volver de Outstand.

### Redirect URLs

Añade las URLs donde el usuario **aterriza** tras el flujo OAuth de redes sociales (callback y página de selección). Si no están en la lista, Supabase puede tratar la visita como "no autorizada" y limpiar o no aceptar la sesión:

```
https://app.makinari.com/api/social/callback/facebook
https://app.makinari.com/api/social/callback/linkedin
https://app.makinari.com/settings/social_network
```

Si Supabase admite un patrón (p. ej. `https://app.makinari.com/**`), puedes usarlo para cubrir estas y otras rutas bajo el mismo dominio.

**Con túnel (desarrollo):** la URL del túnel cambia cada vez. Añade temporalmente las equivalentes, p. ej.  
`https://TU-SUBDOMINIO.trycloudflare.com/api/social/callback/facebook` y  
`https://TU-SUBDOMINIO.trycloudflare.com/settings/social_network`, o usa `redirect_uri` de producción y prueba en producción.

### Desplegar el código que evita borrar sesión

En producción, si **no** está desplegado el código que:

- omite Supabase en el middleware para `/api/social/*` y `/settings/social_network`, y  
- usa `createSocialSupabaseClient` (que no borra cookies) en auth-url, pending y finalize,

entonces el `createServerClient` del middleware sigue ejecutándose en el callback y en `/settings/social_network`. En esas peticiones, `getUser`/`getSession` pueden **borrar la cookie** al fallar o al hacer refresh (más probable justo después de un redirect cross-site).  
Despliega esos cambios a producción para que, en esas rutas, no se toquen las cookies de Supabase y la sesión se mantenga al volver de Outstand.

## Facebook Configuration

### Step 1: Configure Facebook App Settings

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Select your app
3. Go to **Settings > Basic**

#### Add App Domains (CRITICAL):
In the "App Domains" field (Settings > Basic), you MUST add:
```
outstand.so
www.outstand.so
app.makinari.com
```

**⚠️ CRITICAL RULES:**
- **NO** `http://` or `https://` prefixes
- **NO** trailing slashes `/`
- **NO** paths (just the domain)
- **ONLY** the domain name itself
- Add each domain on a **separate line** or **comma-separated**

**Example of CORRECT format:**
```
outstand.so
www.outstand.so
app.makinari.com
```

**Example of WRONG format:**
```
❌ https://outstand.so
❌ http://outstand.so
❌ outstand.so/
❌ www.outstand.so/app/api
```

**⚠️ IMPORTANT:** Facebook redirects to **Outstand**, so the redirect URI's domain is `outstand.so`. **App Domains** must include `outstand.so` and `www.outstand.so`. Also add `app.makinari.com` (and your tunnel domain if used) so our app works when Outstand redirects the user to us. Missing domains cause "El dominio de esta URL no está incluido en los dominios de la app".

#### Add OAuth Redirect URIs:

**IMPORTANT:** If you don't see "Facebook Login" in the left sidebar, you need to add it first:

1. **Add Facebook Login Product:**
   - In the left sidebar, look for **"Products"** or **"Add Product"**
   - Find **"Facebook Login"** and click **"Set Up"** or **"Add"**
   - This will add the Facebook Login product to your app

2. **Find OAuth Redirect URIs Settings:**

   **Option A - Via Products Menu:**
   - After adding Facebook Login, click on **"Facebook Login"** in the left sidebar
   - Click **"Settings"** under Facebook Login
   - Look for **"Client OAuth Settings"** section
   - Find the **"Valid OAuth Redirect URIs"** field

   **Option B - Via Use Cases (Alternative path):**
   - On the app dashboard, click **"Use Cases"** (top menu or left sidebar)
   - Under **"Authentication and Account Creation"**, select **"Customize"**
   - Click **"Go to Settings"** button
   - You should see **"Client OAuth Settings"** with **"Valid OAuth Redirect URIs"** field

3. **Add Redirect URIs (must include Outstand's callback):**
   **Facebook redirects to Outstand** (the `redirect_uri` in the Facebook dialog is Outstand's). So **Valid OAuth Redirect URIs** must include **Outstand's** URL:
   ```
   https://www.outstand.so/app/api/socials/facebook/callback
   https://outstand.so/app/api/socials/facebook/callback
   ```
   **Our** URL (e.g. `https://app.makinari.com/api/social/callback/facebook`) is passed to Outstand when we request auth-url; **Outstand** sends the user to us with `?session=...` or `?error=...`. **Do not** add our URL here — Facebook never redirects to us.

4. **Enable OAuth Login Types:**
   - In the same **"Client OAuth Settings"** section
   - Make sure **"Web OAuth Login"** is enabled (toggle ON)
   - Also enable **"Client OAuth Login"** if available

5. **Save Changes:**
   - Scroll to the bottom and click **"Save Changes"**
   - Reload the page to verify changes persisted

**Important Notes:**
- The redirect URI in Facebook must match **exactly** Outstand's callback (`https://www.outstand.so/app/api/socials/facebook/callback`). Include both `www` and non-`www` if needed. Our path `/api/social/callback/facebook` is only used by Outstand to send the user to us; `/settings/social_network` is the page-selection screen.
- **App Domains** (Settings > Basic) and **Redirect URIs** (Facebook Login > Settings) are **DIFFERENT** settings - you need BOTH configured correctly
- **App Domains** = just domain names (no protocol, no path)
- **Redirect URIs** = full URLs with protocol and path

### Step 2: Verify Configuration

After adding the domains and redirect URIs:
1. Save all changes
2. Wait a few minutes for changes to propagate
3. Try the OAuth flow again

### Step 3: Testing

1. Click "Connect Account" on a social network in Settings
2. You should be redirected to Facebook's OAuth page
3. After authorizing, Facebook redirects to **Outstand**; **Outstand** then redirects to our callback with `?session=xxx` (or `?error=...` on failure) and you see the page-selection screen

## Troubleshooting

### Error: "Domain not included in app domains" or "El dominio de esta URL no está incluido en los dominios de la app"

**This error means Facebook is rejecting the OAuth URL because `outstand.so` is not in your App Domains.**

**Solution - Step by Step:**

1. **Go to Facebook Developers Console:**
   - Navigate to [Facebook Developers](https://developers.facebook.com/)
   - Select your app
   - Go to **Settings > Basic** (NOT Facebook Login > Settings)

2. **Find "App Domains" field:**
   - Scroll down to find the "App Domains" field
   - This is a **text input field**, not a list

3. **Add domains (ONE PER LINE or comma-separated):**
   ```
   outstand.so
   www.outstand.so
   app.makinari.com
   ```
   - **DO NOT** include `http://` or `https://`
   - **DO NOT** include trailing slashes
   - **DO NOT** include paths
   - Just the domain name itself

4. **Save changes:**
   - Click "Save Changes" at the bottom of the page
   - Wait 2-5 minutes for changes to propagate

5. **Configure OAuth Redirect URIs:**
   
   **If "Facebook Login" is not visible:**
   - Go to **"Products"** or **"Add Product"** in the left sidebar
   - Add **"Facebook Login"** product if not already added
   - Then follow the steps below
   
   **To find OAuth Redirect URIs:**
   - Click **"Facebook Login"** in the left sidebar → **"Settings"**
   - OR go to **"Use Cases"** → **"Authentication and Account Creation"** → **"Customize"** → **"Go to Settings"**
   - In **"Client OAuth Settings"**, find **"Valid OAuth Redirect URIs"**
   - Add:
     ```
     https://www.outstand.so/app/api/socials/facebook/callback
     https://outstand.so/app/api/socials/facebook/callback
     ```
   - Enable **"Web OAuth Login"** toggle
   - **Save changes**

6. **Test again:**
   - Wait a few minutes after saving
   - Try the OAuth flow again
   - Clear browser cache if needed

**Common Mistakes:**
- ❌ Adding `https://outstand.so` in App Domains (should be just `outstand.so`)
- ❌ Adding the redirect URI in App Domains (should be in Facebook Login > Settings)
- ❌ Not saving changes after adding domains
- ❌ Not waiting for changes to propagate

### Error: "Invalid redirect_uri"

**Solution:**
- The redirect URI in "Valid OAuth Redirect URIs" must match **exactly** the `redirect_uri` in the Facebook OAuth request.
- **3-leg:** use our callback, e.g. `https://app.makinari.com/api/social/callback/facebook` (or your tunnel URL).
- **2-leg:** use Outstand's, e.g. `https://www.outstand.so/app/api/socials/facebook/callback`.
- No trailing slashes or extra characters.

### Error: "Missing code or state parameter"

**White-label flow:** This error is sent by **Outstand** when they don't receive or can't process `code` and `state` from **Facebook**. The fix is on the **Facebook ↔ Outstand** side: (1) **Outstand's** callback (`https://www.outstand.so/app/api/socials/facebook/callback`) must be in your Facebook App's **Valid OAuth Redirect URIs**. (2) **App Domains** must include `outstand.so` and `www.outstand.so`. (3) If it still fails, contact Outstand (contact@outstand.so): their backend may be failing to handle the Facebook callback. The `redirect_uri` we pass to Outstand (our callback) is only for Outstand→us; it does **not** go in Facebook. Our callback already shows a short help for this error.

---

**What's happening:**

This can occur when Outstand receives the callback from Facebook but cannot process it, and redirects to your app with this error.

**What's happening:**
1. ✅ Your app calls Outstand API and gets the auth_url
2. ✅ User is redirected to Facebook OAuth
3. ✅ User authorizes on Facebook
4. ✅ Facebook redirects to `https://www.outstand.so/app/api/socials/facebook/callback` with code and state
5. ❌ Outstand fails to process and redirects to your app with this error

**Possible causes:**

1. **Outstand.so internal issue**
   - The state parameter might not be matching in outstand.so's session storage
   - There might be a timing issue in their callback processing
   - Their OAuth configuration might have an issue

2. **Facebook App configuration**
   - Verify that `www.outstand.so` is correctly configured in Facebook
   - Make sure the redirect URI in Facebook matches exactly: `https://www.outstand.so/app/api/socials/facebook/callback`
   - Check that the App Domains include both `outstand.so` and `www.outstand.so`

3. **The redirect_uri you pass to outstand.so needs to be whitelisted in their system**
   - **This is the most likely cause of the error**
   - **CRITICAL:** Outstand.so validates the `redirect_uri` you send them before redirecting back to your app
   - If your `redirect_uri` is not whitelisted, outstand.so will fail to process the Facebook callback and redirect with the error
   - Contact outstand.so support at **contact@outstand.so** to whitelist your callback URL
   - Our `redirect_uri` is our callback, e.g. `https://app.makinari.com/api/social/callback/facebook` (or your tunnel). Outstand must allow redirecting to it. Contact Outstand to whitelist your callback pattern (e.g. `https://app.makinari.com/api/social/callback/facebook` or `https://*.trycloudflare.com/api/social/callback/facebook` for tunnels).

**Troubleshooting steps:**
1. Check browser console for detailed logs (you'll see the redirect_uri being used)
2. Check server logs for the outstand.so API response (status 200 means the auth_url was generated successfully)
3. Try the authentication flow again (sometimes it's a timing issue with state management)
4. **Contact outstand.so support** - This appears to be an issue on their side with processing the Facebook callback
5. Verify Facebook App settings are correct (domains and redirect URIs)

**What to tell outstand.so support:**

**Email Template:**
```
Subject: Request to whitelist redirect_uri for Facebook OAuth integration

Hi outstand.so support,

I'm integrating Facebook OAuth using your BYOK model and getting the error "Missing code or state parameter" when outstand.so tries to redirect back to my app.

Details:
- My redirect_uri (our callback): https://app.makinari.com/api/social/callback/facebook
- The auth_url generation works fine (returns 200)
- Facebook OAuth page loads and user can authorize
- Facebook redirects to outstand.so callback successfully
- The error occurs when outstand.so tries to redirect back to my app

I believe my redirect_uri needs to be whitelisted in your system. Could you please:
1. Whitelist our callback: https://app.makinari.com/api/social/callback/facebook (and our tunnel URL if we use one)
2. Verify your OAuth callback handler for Facebook is working correctly

Thank you!
```

**Key points to mention:**
- You're getting "Missing code or state parameter" error
- The auth_url generation works fine (returns 200)
- Facebook OAuth page loads correctly
- The error occurs when outstand.so tries to redirect back to your app (not when Facebook redirects to outstand.so)
- Your callback (redirect_uri we send) may need to be whitelisted: `https://app.makinari.com/api/social/callback/facebook`
- Ask them to check their OAuth callback handler for Facebook

### Still having issues?

1. Check the browser console for detailed error messages
2. Verify your `OUTSTAND_API_KEY` is correctly set in `.env.local`
3. Check that the network name is correctly mapped (e.g., "twitter" → "x")
4. Review the server logs for API call details
5. Check the callback URL parameters in the browser address bar when the error occurs

## LinkedIn Configuration (3-leg)

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps) → your app → **Auth**.
2. **Authorized redirect URLs:** add (3-leg uses our callback, not outstand’s):
   ```
   https://app.makinari.com/api/social/callback/linkedin
   ```
   and optionally `https://outstand.so/.../linkedin/callback` if you also use a non–3-leg flow.
3. **OAuth 2.0 scopes:** ensure the scopes requested by outstand are authorized for your app (e.g. if you see `unauthorized_scope_error`, request the missing products/scopes in the LinkedIn app).

## Exchange endpoint (3-leg: Facebook & LinkedIn)

For 3-leg, our callback must exchange `code`+`state` with outstand for a `session` token. The code calls:

- Default: `POST {OUTSTAND_API_URL}/v1/social-accounts/oauth/callback`  
  Body: `{ code, state, redirect_uri, network }`

If that path is wrong, **ask support: “What is the exact API to exchange OAuth code+state for a session token in the 3-leg flow for Facebook and LinkedIn?”**

Override via env:

- `OUTSTAND_OAUTH_EXCHANGE_URL`: full URL (e.g. `https://api.outstand.so/v1/oauth/exchange`) or path (e.g. `/v1/oauth/exchange`).

## Other Social Networks

For **Facebook** and **LinkedIn** we use the **3-leg** flow and our callback:  
`https://app.makinari.com/api/social/callback/{facebook|linkedin}`.

For other networks the redirect may still go to outstand; format:  
`https://www.outstand.so/app/api/socials/{network}/callback`.

Configure the OAuth settings for each network in their respective developer portals.
