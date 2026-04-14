# API Keys & Environment Variables Setup Guide

This document lists all the API keys and credentials needed to run the College Counselling App.

## 📋 Required Environment Variables

Create a `.env` file in the `server` directory with the following variables:

---

## 1. **Supabase Configuration** (Required)

Supabase is used for the database and authentication.

### How to get (Available in FREE tier):
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up/Login and create a new project (free tier works perfectly!)
3. In your project dashboard, click **Settings** (⚙️ icon in left sidebar)
4. Click **API** (under Project Settings)
5. You'll see three values:
   - **Project URL** → Copy this as `SUPABASE_URL`
   - **anon public** key → Copy this as `SUPABASE_ANON_KEY`
   - **service_role** key → Click "Reveal" button, then copy as `SUPABASE_SERVICE_ROLE_KEY`

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjQ1NzI4MDAwLCJleHAiOjE5NjEzMDQwMDB9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdC1pZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDU3MjgwMDAsImV4cCI6MTk2MTMwNDAwMH0...
```

**Important Notes:** 
- ✅ **All keys are available in FREE tier** - no payment required
- `SUPABASE_ANON_KEY` - Public key (safe for client-side React app)
- `SUPABASE_SERVICE_ROLE_KEY` - **PRIVATE KEY** (server-side only, bypasses RLS)
  - ⚠️ **NEVER expose this in client code or commit to Git**
  - ⚠️ Only use in your Node.js backend server
  - ⚠️ This key has admin access to your database

---

## 2. **JWT Secret** (Required)

Used for signing and verifying authentication tokens.

```env
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
```

**How to generate:**
- Use a random string generator
- Minimum 32 characters recommended
- Example: `openssl rand -base64 32`

---

## 3. **Email Configuration** (Required for OTP)

Used for sending OTP emails to users.

### Option A: Gmail (Recommended for development)

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**How to get Gmail App Password:**
1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to **Security** → **2-Step Verification** → **App passwords**
4. Generate a new app password for "Mail"
5. Use this 16-character password (not your regular Gmail password)

### Option B: Other SMTP Providers

```env
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com
EMAIL_PASS=your-password
```

**Popular SMTP Providers:**
- **SendGrid**: `smtp.sendgrid.net` (Port: 587)
- **Mailgun**: `smtp.mailgun.org` (Port: 587)
- **AWS SES**: `email-smtp.region.amazonaws.com` (Port: 587)

---

## 4. **Twilio Configuration** (Removed)

Twilio is no longer used. Student authentication is handled through Supabase Auth.

---

## 5. **Zoom OAuth Configuration** (Required for Video Sessions - FREE Tier)

Used for video/audio counselling sessions via Zoom API.

```env
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_SECRET_TOKEN=your-zoom-secret-token
```

**How to get (FREE Zoom Account):**
1. Go to [https://marketplace.zoom.us](https://marketplace.zoom.us)
2. Sign in with your **FREE Zoom account** (no paid plan needed)
3. Go to **Develop** → **Build App**
4. Choose **OAuth** → **Server-to-Server OAuth**
5. Fill in app details:
   - App name: "Counselling App"
   - Company name: Your organization
   - Developer contact: Your email
6. Add scopes: `meeting:write`, `meeting:read`
7. After creating, you'll see:
   - **Account ID** → Copy as `ZOOM_ACCOUNT_ID`
   - **Client ID** → Copy as `ZOOM_CLIENT_ID`
   - **Client Secret** → Copy as `ZOOM_CLIENT_SECRET`
8. Go to **App Credentials** tab to find **Secret Token** → Copy as `ZOOM_SECRET_TOKEN`

**Note:** 
- ✅ **FREE Zoom account works perfectly** - no paid plan required
- OAuth is the recommended method for server-side meeting creation
- These credentials allow creating meetings programmatically

---

## 6. **Server Configuration** (Optional)

```env
PORT=5000
NODE_ENV=development
```

---

## 📝 Complete `.env` File Template

Create `server/.env` with all variables:

```env
# Supabase Configuration
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-this-in-production

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=pallavisingh153@gmail.com
EMAIL_PASS=lcxa dwuj epwj zpwv

# Twilio removed - using Supabase Auth for students

# Zoom OAuth Configuration (FREE Tier)
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_SECRET_TOKEN=your-zoom-secret-token
```

---

## 🔒 Security Best Practices

1. **Never commit `.env` file to Git**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as a template

2. **Use different keys for development and production**
   - Development: Use free tier services
   - Production: Use paid/verified accounts

3. **Rotate keys regularly**
   - Change JWT_SECRET periodically
   - Update API keys if compromised

4. **Use environment-specific configs**
   - Development: `.env.development`
   - Production: `.env.production`

---





## 🚀 Quick Setup Steps

1. **Set up Supabase:**
   ```bash
   # Run the schema SQL in Supabase SQL Editor
   # File: supabase/schema.sql
   ```

2. **Create `.env` file:**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your actual keys
   ```

3. **Install dependencies:**
   ```bash
   npm run install-all
   ```

4. **Start the app:**
   ```bash
   npm run dev
   ```

---

## 📞 Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Twilio Docs**: https://www.twilio.com/docs
- **Zoom SDK Docs**: https://developers.zoom.us/docs/video-sdk/
- **Nodemailer Docs**: https://nodemailer.com/about/

---

## ⚠️ Important Notes

- **Free Tier Limits:**
  - Supabase: 500MB database, 2GB bandwidth
  - Twilio: Limited SMS credits on free tier
  - Zoom: Free SDK has usage limits

- **Production Considerations:**
  - Use environment variables in hosting platform (Vercel, Heroku, AWS, etc.)
  - Enable rate limiting
  - Set up monitoring and logging
  - Use HTTPS only
  - Implement proper error handling
