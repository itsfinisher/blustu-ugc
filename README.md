# BluStu Creator Portal

A premium creator platform built with **Next.js 14**, **Supabase**, and **Tailwind CSS**. Creators can browse paid campaigns, submit social media content, and track their earnings — all powered by the MediaMaxxing Partner API via secure Supabase Edge Functions.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Auth & Database:** Supabase (Auth + Postgres + Edge Functions)
- **Styling:** Tailwind CSS with BluStu design tokens
- **API Proxy:** Supabase Edge Functions (Deno) — keeps the MediaMaxxing API key server-side
- **Toast Notifications:** Sonner

## Project Structure

```
blustu-creator-portal/
├── middleware.ts                    # Auth guard — redirects unauthenticated users
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout (fonts, metadata, toaster)
│   │   ├── globals.css             # Tailwind + BluStu CSS variables
│   │   ├── page.tsx                # Redirect / → /dashboard
│   │   ├── auth/
│   │   │   ├── layout.tsx          # Split-panel auth layout (branded side panel)
│   │   │   ├── sign-in/page.tsx    # Email + password sign-in
│   │   │   ├── sign-up/page.tsx    # Username + email + password sign-up
│   │   │   └── forgot-password/page.tsx
│   │   └── (app)/
│   │       ├── layout.tsx          # App shell (navbar + user context)
│   │       ├── dashboard/page.tsx  # Welcome, stats, latest campaigns
│   │       ├── campaigns/page.tsx  # Campaign grid + detail modal + submit
│   │       └── submissions/page.tsx # Stats, filters, submission list
│   ├── components/
│   │   ├── Navbar.tsx              # Top nav (desktop) + bottom nav (mobile)
│   │   ├── CampaignCard.tsx        # Campaign card with brand, RPM, platforms
│   │   ├── CampaignModal.tsx       # Campaign detail + submission form
│   │   ├── StatCard.tsx            # KPI stat card
│   │   └── CardSkeleton.tsx        # Loading skeleton
│   └── lib/
│       ├── api.ts                  # API client — calls edge functions
│       ├── supabase-browser.ts     # Browser Supabase client
│       ├── supabase-middleware.ts   # Middleware Supabase client
│       └── utils.ts                # relativeTime, platformIcon, statusStyle, cn
├── supabase/
│   ├── migrations/
│   │   └── 001_profiles.sql        # profiles table with RLS
│   └── functions/
│       ├── get-campaigns/index.ts   # GET /campaigns proxy
│       ├── submit-content/index.ts  # POST /submissions proxy
│       └── get-submissions/index.ts # GET /submissions proxy
├── public/
│   └── logos/                       # BluStu logo assets (4 variants)
└── tailwind.config.js               # BluStu colour palette + font config
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com) and create a new project.

### 3. Disable email confirmation

In your Supabase dashboard:
- Go to **Authentication → Providers → Email**
- Toggle OFF **"Confirm email"**
- This allows users to sign up and use the app immediately

### 4. Run the database migration

```bash
npx supabase db push
```

Or manually run `supabase/migrations/001_profiles.sql` in the SQL Editor.

### 5. Deploy Edge Functions

```bash
npx supabase functions deploy get-campaigns
npx supabase functions deploy submit-content
npx supabase functions deploy get-submissions
```

### 6. Set the MediaMaxxing API secret

```bash
npx supabase secrets set MEDIAMAXXING_API_KEY=your-key-here
```

> **CRITICAL:** This key is NEVER exposed to the browser. All API calls go through the edge functions which inject the key server-side.

### 7. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase project URL and anon key:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 8. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

| Path | Auth | Description |
|------|------|-------------|
| `/auth/sign-up` | Public | Create account with username |
| `/auth/sign-in` | Public | Email + password login |
| `/auth/forgot-password` | Public | Password reset |
| `/dashboard` | Protected | Welcome, stats, latest campaigns |
| `/campaigns` | Protected | Browse all campaigns, submit content |
| `/submissions` | Protected | Track submissions, views, earnings |

## Design System

### Colour Tokens (CSS Variables)

| Token | Value | Usage |
|-------|-------|-------|
| `--blu-primary` | `#2F95E8` | Buttons, links, active states, accents |
| `--blu-primary-hover` | `#1E7DD4` | Hover states |
| `--blu-soft` | `#EFF7FF` | Soft blue backgrounds, highlight cards |
| `--blu-soft-border` | `#BFDBFE` | Borders on highlighted elements |
| `--blu-text` | `#111827` | Primary text |
| `--blu-muted` | `#6B7280` | Secondary text |
| `--blu-dim` | `#9CA3AF` | Tertiary text, placeholders |
| `--blu-bg` | `#F8FAFC` | Page background |
| `--blu-border` | `#E5E7EB` | Card/input borders |

### Typography

- **Display:** Outfit (headings, stat values, brand text)
- **Body:** DM Sans (body text, labels, navigation)

### Logo Assets

| File | Background | Use |
|------|-----------|-----|
| `blustu-wordmark-blue.png` | Blue | Navbar, mobile auth |
| `blustu-full-blue.png` | Blue | Marketing / wider contexts |
| `blustu-wordmark-dark.png` | Black | Favicon / dark backgrounds |
| `blustu-full-dark.png` | Black | Auth side panel (with CSS invert) |

## API Flow

```
Browser → Supabase Edge Function → MediaMaxxing API
         (JWT verified)           (Bearer token injected)
```

The browser never sees the MediaMaxxing API key. Each edge function:
1. Validates the Supabase JWT from the `Authorization` header
2. Injects the `MEDIAMAXXING_API_KEY` secret
3. Proxies the request to the MediaMaxxing API
4. Returns the response as-is
