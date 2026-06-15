# Utilyze — Energy Savings SMS Alert System

Utilyze is an internal admin tool that automatically texts business owners when two conditions are true at the same time:

1. The current time is inside a configured **peak pricing window** for their city's utility company
2. The **outdoor temperature** at their location is at or above a configured threshold

Example message:
> "Energy savings alert: It's 98°F in San Antonio and peak demand hours are active until 7:00 PM. Consider raising your thermostat a few degrees."

The alert engine runs every 15 minutes via a Vercel Cron Job. This dashboard is for internal admin use only — there is no customer-facing portal.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database + Auth | Supabase (Postgres + Supabase Auth) |
| Hosting + Cron | Vercel |
| SMS | Twilio Programmable Messaging |
| Weather | Open-Meteo API (free, no key required) |
| Styling | Tailwind CSS |
| Language | TypeScript |

---

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase keys (see Supabase Setup below). Leave Twilio keys blank for now if you haven't set that up yet — `ALERT_TEST_MODE=true` means no real SMS will be sent.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to `/login`. Sign in with the admin account you created in Supabase (see below).

---

## Supabase Setup

### 1. Create a project

- Go to [supabase.com](https://supabase.com) → New project
- Name it `utilyze`, choose a strong password, pick a region close to you
- Wait for the project to provision (~1 minute)

### 2. Run the migrations

Go to **SQL Editor** in the left sidebar and run each file in order:

**First:** paste and run `supabase/migrations/001_initial_schema.sql`
This creates all 8 database tables.

**Second:** paste and run `supabase/migrations/002_seed_san_antonio.sql`
This adds the CPS Energy peak window rule, 3 alert message templates, and a demo San Antonio business with 2 test contacts.

### 3. Enable Row Level Security

Run this in the SQL Editor to lock down the database:

```sql
alter table businesses enable row level security;
alter table locations enable row level security;
alter table contacts enable row level security;
alter table utility_rate_rules enable row level security;
alter table alert_templates enable row level security;
alter table weather_observations enable row level security;
alter table alert_logs enable row level security;
alter table provider_settings enable row level security;
```

No policies needed — with RLS on and no policies, the public anon key (which is in the browser bundle) can't read any data. The server uses the service_role key which bypasses RLS.

### 4. Create your admin account

Go to **Authentication → Users → Add user** and create an email + password. This is your login for the dashboard.

### 5. Copy your API keys

Go to **Project Settings → API** and copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## Twilio Setup

> You only need this when you're ready to send real SMS messages. Skip it while `ALERT_TEST_MODE=true`.

### 1. Create an account

Sign up at [twilio.com](https://twilio.com). Go to the Console to find:
- **Account SID** → `TWILIO_ACCOUNT_SID`
- **Auth Token** → `TWILIO_AUTH_TOKEN`

### 2. Get a phone number or Messaging Service

**Option A (recommended) — Messaging Service:**
- Console → Messaging → Services → Create a Messaging Service
- Add a phone number to it
- Copy the **Messaging Service SID** → `TWILIO_MESSAGING_SERVICE_SID`

**Option B — Single number:**
- Console → Phone Numbers → Buy a number
- Copy the number in E.164 format (e.g. `+12105550100`) → `TWILIO_FROM_NUMBER`

### 3. Set the inbound webhook

To handle STOP/UNSUBSCRIBE replies from contacts:
- Go to the phone number's configuration page (or Messaging Service → Sender Pool → click number)
- Set **"A message comes in" webhook** to: `https://your-vercel-domain.vercel.app/api/twilio/inbound`
- Method: HTTP POST

### 4. Flip to live mode

Set `ALERT_TEST_MODE=false` in your Vercel environment variables. The engine will now send real SMS messages.

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git remote add origin https://github.com/your-username/utilyze.git
git push -u origin main
```

### 2. Import on Vercel

- Go to [vercel.com](https://vercel.com) → Add New Project → Import your GitHub repo
- Framework preset: **Next.js** (auto-detected)

### 3. Add environment variables

In the Vercel project settings → Environment Variables, add every variable from `.env.local.example` with your real values. Make sure `CRON_SECRET` is a long random string (run `openssl rand -hex 32` in your terminal to generate one).

### 4. Deploy

Click Deploy. Vercel will build and deploy the app.

### 5. Cron is automatic

`vercel.json` at the root of the repo tells Vercel to call `/api/cron/run-alert-check` every 15 minutes. No additional setup needed. Vercel automatically sends your `CRON_SECRET` as a Bearer token with every cron request.

You can verify cron runs in the Vercel dashboard under **Settings → Cron Jobs**.

---

## How to Add a New City or Utility

No code change needed. Just add a rule:

1. Log into the dashboard → **Rules** → **Add Rule**
2. Fill in the utility name, city, state, season window, time window, days of week, and temperature threshold
3. Save it — the alert engine will pick it up on the next cron run

Make sure there's also at least one **Location** for that city with matching `city`, `state`, and `utility_name` fields, and at least one active **Contact** for that business.

---

## Testing Without Sending Real SMS

`ALERT_TEST_MODE=true` is the default in `.env.local.example`. While this is set:

- The alert engine runs the full matching logic
- Instead of calling Twilio, it logs the message to the console and writes a row to `alert_logs` with `status = 'test_logged'`
- You can see every test_logged entry in the dashboard under **Alert Logs**

To trigger a test run from the UI:
- Go to **Alert Logs** → click **"Run Alert Check Now"** to run for all locations
- Or click **"Send Test Alert"** → pick a location → runs for just that location

---

## Known Limitations and Future TODOs

- **TODO:** Integrate a tariff database API (OpenEI, Genability, or Arcadia) to auto-populate rate rules instead of entering them manually
- **TODO:** Validate Twilio request signature on `/api/twilio/inbound` to prevent spoofed STOP requests
- **TODO:** Multi-user roles and permissions (currently any admin account has full access)
- **TODO:** Customer-facing portal for businesses to manage their own contacts and preferences
- **TODO:** Exact savings calculations based on actual usage/meter data
- **TODO:** Support for demand-response program enrollment
- **TODO:** Smart thermostat integrations (Nest, Ecobee, etc.)
- **TODO:** Seasons that span year-end (e.g. November–February) — the current season check assumes start month ≤ end month
- **TODO:** Multi-location contact assignment (currently a contact is linked to one location or all locations for a business)

---

## Project Structure

```
/app
  /api              ← all API route handlers
  /dashboard        ← admin UI pages
  /login            ← auth page
/lib
  supabase.ts       ← Supabase client factory functions
  weather.ts        ← Open-Meteo temperature fetch
  sms.ts            ← Twilio send (with test mode guard)
  alert-engine.ts   ← core matching + send logic
  auth.ts           ← session check helpers
/types
  index.ts          ← TypeScript interfaces for all DB tables
/supabase
  /migrations       ← SQL files to run in Supabase SQL Editor
middleware.ts       ← Edge auth guard for /dashboard/*
vercel.json         ← Vercel Cron config
```
