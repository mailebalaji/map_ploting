# 🔒 Secure API Key Setup for Vercel

## Problem
The map needs an API key to initialize, but we don't want it exposed in browser dev tools or network requests.

## Solution
✅ **Secure Backend Architecture**
- Frontend requests API key via POST `/api/init-map` endpoint
- API key is returned only for map initialization
- All other OLA API calls go through backend proxy endpoints
- API key stays safe on the server

## Steps to Deploy Securely

### 1. Get Your Ola Maps Credentials
Go to https://dashboard.olamaps.io and get:
- `OLA_API_KEY` (for map display)
- `OLA_PROJECT_ID`
- `OLA_CLIENT_ID` (for OAuth)
- `OLA_CLIENT_SECRET` (for OAuth)

### 2. Set Environment Variables in Vercel

1. Go to your project: https://vercel.com/maile-balaji-s-projects/fixed
2. Click **Settings** → **Environment Variables**
3. Add these variables:
   - `OLA_API_KEY` = your_api_key
   - `OLA_PROJECT_ID` = your_project_id
   - `OLA_CLIENT_ID` = your_client_id
   - `OLA_CLIENT_SECRET` = your_client_secret

### 3. Restrict Your API Key (Ola Maps Dashboard)

In https://dashboard.olamaps.io:
1. Go to your API key settings
2. Set **Allowed Domains** to: `*.vercel.app`
3. Set **API Restrictions** to read-only if available
4. Save

### 4. Redeploy to Vercel
```powershell
vercel --prod
```

## How It Works

```
Frontend → /api/init-map (POST) → Backend 🔑 → Server Memory
          ↓
       Map Initializes (with key from backend)
          ↓
Frontend → /api/directions, /api/autocomplete, etc. → Backend uses key securely
```

The API key is never exposed in browser network requests or dev tools!

## Security Best Practices

✅ **DO**
- Rotate API keys every 90 days
- Use domain restrictions in Ola Maps console
- Keep .env file in .gitignore
- Use read-only API keys when possible

❌ **DON'T**
- Hardcode keys in code
- Share API keys in Slack or email
- Use personal API keys for production
- Commit .env to Git

## Testing

Check your browser DevTools → Network tab. You should see:
- POST `/api/init-map` returns the key
- GET requests to OLA Maps APIs go through backend endpoints
