# Trellis Reach

The Trellis Reach Marketing App by QVTrellis. Created by Alicia Spears.

> **Vision (Alicia Spears):** Marketing for all apps. Ad generator, video generator, funnel, email and phone contacts, AI fills the app, the app runs campaigns, learning and community, plug-ins, affiliates, Seed Loop, and more opportunities to uplift people.

- **Hivecast** (the public home page): the funnel visitors see, with the seven paths, "Keep me posted", and AI questions and answers.
- **Team dashboard** (`/app`): the Money Board, three AI agents (Marketing Chef, Creator AI, Follow-up AI), leads and income data with an Excel download, the calendar, the community board, and brand settings.
- **Plug-in slots** for Stripe, Twilio, email, AI video, social posting, calendar sync and e-signature, which switch on as their keys are added.

Built with Next.js, Supabase (database, sign-in, live updates) and the Anthropic API.

---

## Put it live on qvtrellis.net

You need four free or low-cost accounts, all in your own name: GitHub (you have it), **Supabase**, **Vercel** and **Anthropic**. Allow about an hour.

### 1. Database (Supabase)

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Name it `trellis-reach` and save the database password somewhere safe.
2. Open **SQL Editor → New query**. Paste everything from `supabase/schema.sql` and click **Run**.
3. In a new query, add yourself as owner (use your own sign-in email, all lowercase) and run it:
   ```sql
   insert into team_members (email, role) values ('you@example.com', 'owner');
   ```
4. Optional: run `supabase/seed.sql` for example rows.
5. Go to **Project Settings → API** and keep this page open. You need the **Project URL**, the **anon public** key and the **service_role** key.
6. Go to **Authentication → URL Configuration**. Set **Site URL** to `https://qvtrellis.net` and add `https://qvtrellis.net/app` to **Redirect URLs**.

### 2. AI key (Anthropic)

1. Sign up at [console.anthropic.com](https://console.anthropic.com), add billing and set a monthly spending limit.
2. Create an API key and copy it.

### 3. Hosting (Vercel)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. Click **Add New → Project** and import the `trellis-reach` repository.
3. Before deploying, open **Environment Variables** and add every name from `.env.example` with your real values:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://qvtrellis.net`
4. Click **Deploy**.

### 4. Your domain

1. In Vercel, open the project → **Settings → Domains**, and add `qvtrellis.net` (and `www.qvtrellis.net`).
2. Vercel shows one or two DNS records. Add exactly those at the company where you bought the domain, under its DNS settings.
3. Wait for the green check. It can take from a few minutes to a few hours.

To use a subdomain instead, add `reach.qvtrellis.net` in step 1 and use that address everywhere above.

### 5. First sign-in (password, recommended)

1. In Supabase, go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, tick **Auto Confirm User**, and click Create.
2. Make sure that same email is on the team list (step 1.3 above).
3. Go to `https://qvtrellis.net/login`, choose **Password**, and sign in.

To add teammates: create them as users the same way, and insert their emails into `team_members` with a role such as `member`, `closer` or `creator`.

### Check your setup

Open `https://qvtrellis.net/api/health`. Every line should say `true`. If one says `false`:

| Line | Fix |
| --- | --- |
| `supabaseUrl`, `supabaseAnonKey`, `supabaseServiceKey`, `anthropicKey` | Add that key in Vercel → Settings → Environment Variables, then **Redeploy**. |
| `schemaInstalled` | Run `supabase/schema.sql` in the Supabase SQL Editor. |
| `teamHasOwner` | Run the `insert into team_members …` line with your email. |

### Email sign-in codes

Supabase's built-in email only sends to the email on your Supabase account, and only 2 emails per hour. That's why codes may not arrive. For the team, use password sign-in. To send codes to anyone:

1. Connect a sender in **Authentication → Emails → SMTP Settings** (Resend works well; use your qvtrellis.net address).
2. In **Authentication → Emails → Templates → Magic Link**, add `{{ .Token }}` to the message so the email shows the 6-digit code.

## Voice

The Chef has a hands-free **Start talking** mode: it asks questions out loud, listens, and fills in the profile. Hivecast visitors can tap **Talk to fill this in**, and there are mic buttons on the other writing fields. Voice uses the browser's own speech recognition, so it works in Chrome, Edge and Safari (including iPhone), but not Firefox. The first time, the browser asks for microphone permission.

---

## Security built in

- Only emails on the team list can open the dashboard or call the AI agents, and the database enforces this too.
- Public visitors can only submit the funnel forms and ask questions. Those go through server routes with validation, a hidden bot trap and rate limits.
- Secret keys stay on the server and are never sent to the browser.
- Texts and calls are blocked unless the lead gave consent. Every AI prompt carries the same honesty and compliance rules: no invented results, unsubscribe and STOP lines, AI disclosure.

## Plug-ins

Each plug-in turns on when its key is added in Vercel's environment variables (`STRIPE_SECRET_KEY`, `TWILIO_AUTH_TOKEN`, `RESEND_API_KEY`, `VIDEO_API_KEY`, `SOCIAL_API_KEY`, `CALENDAR_API_KEY`, `ESIGN_API_KEY`). The Settings page shows which keys are present. The sending and payment code for each plug-in is the next build phase.

## Next build phases

1. **Payments:** Stripe checkout for tiers, yearly plans and payment plans; creator payouts.
2. **Sending:** Resend email and Twilio SMS/voice, with automatic follow-up in under five minutes.
3. **Video:** AI video generation for the photo, describe and one-click modes, with likeness consent records.
4. **Wow factors:** "See your ad in 60 seconds" and the instant personal score report in Hivecast.
5. **Seed Loop and PushPilot:** points, levels, referral links and payouts.

## Work on it locally

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # open http://localhost:3000
```

---

© 2026 Alicia Spears / QVTrellis. All rights reserved.
