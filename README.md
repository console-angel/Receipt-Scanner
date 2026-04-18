# ReceiptiFy

A React + Vite web app that scans receipt images with Gemini AI, stores extracted records in Supabase, and provides a dashboard for tracking spending by category.

## Features

- Email/password login and signup with client-side attempt throttling
- Per-user receipt isolation (each authenticated user sees only their own receipts)
- Settings screen to update username, switch light/dark mode, and change password
- Upload receipt images (JPEG/JPG/PNG)
- Extract store name, total amount, and category using Gemini
- Save and fetch receipts from Supabase
- Filter receipts by month and year, with quick access to all time or the current month
- View spend summaries and category breakdowns
- Export receipts and summary data to CSV

## Tech Stack

- React 19
- Vite 8
- Supabase JavaScript SDK
- Google GenAI SDK
- ESLint

## Prerequisites

- Node.js 18+ (Node.js 20+ recommended)
- npm 9+
- A Supabase project
- A Gemini API key

## Installation

1. Clone the repository.
1. Install dependencies:

```bash
npm install
```

1. Create an environment file named `.env` in the project root.
1. Add the required variables:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

1. Start the development server:

```bash
npm run dev
```

## Required Dependencies

These are installed by `npm install` from `package.json`.

### Runtime dependencies

- `react`
- `react-dom`
- `@supabase/supabase-js`
- `@google/genai`
- `axios`

### Development dependencies

- `vite`
- `@vitejs/plugin-react`
- `eslint`
- `@eslint/js`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`
- `globals`
- `@types/react`
- `@types/react-dom`
- `postcss`
- `autoprefixer`
- `tailwindcss`

## Supabase Setup

The app now expects:

- Supabase Auth with Email provider enabled
- A `profiles` table keyed by `auth.users.id`
- A `receipts` table with `user_id` (UUID) tied to the authenticated user
- Row Level Security policies that scope read/write/delete to the current user

### SQL Editor migration (existing projects)

Run this in Supabase SQL Editor for multi-user auth + receipts:

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

alter table public.receipts
add column if not exists user_id uuid references auth.users (id) on delete cascade,
add column if not exists receipt_date date,
add column if not exists invoice_enabled boolean not null default false,
add column if not exists reimbursement_received_enabled boolean not null default false,
add column if not exists reimbursement_received_amount numeric(10,2);

alter table public.receipts
alter column user_id set not null;

alter table public.profiles enable row level security;
alter table public.receipts enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Profiles are editable by owner" on public.profiles;
create policy "Profiles are editable by owner"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Receipts are viewable by owner" on public.receipts;
create policy "Receipts are viewable by owner"
on public.receipts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Receipts are insertable by owner" on public.receipts;
create policy "Receipts are insertable by owner"
on public.receipts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Receipts are updatable by owner" on public.receipts;
create policy "Receipts are updatable by owner"
on public.receipts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Receipts are deletable by owner" on public.receipts;
create policy "Receipts are deletable by owner"
on public.receipts
for delete
to authenticated
using (auth.uid() = user_id);
```

### Minimum `receipts` table

```sql
create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  store_name text not null,
  total numeric(10,2) not null,
  category text,
  receipt_date date,
  invoice_enabled boolean not null default false,
  reimbursement_received_enabled boolean not null default false,
  reimbursement_received_amount numeric(10,2),
  created_at timestamptz not null default now()
);
```

### Minimum `profiles` table

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);
```

### Notes on login rate limiting

- The app includes client-side throttling (localStorage-based) for repeated failed password attempts.
- For strong production security, also enable and tune Supabase Auth server-side protections in your project Auth settings.

## Available Scripts

- `npm run dev`: Start local dev server
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

## Project Structure

```text
src/
  App.jsx
  App.css
  index.css
  lib/
    gemini.js
    supabase.js
```

## How To Modify

### Change AI extraction behavior

- Edit prompt/model logic in `src/lib/gemini.js`.
- Keep the JSON shape compatible with the app fields:
  - `store_name`
  - `total`
  - `category`
  - `receipt_date` (YYYY-MM-DD or null)

### Change database integration

- Update Supabase client setup in `src/lib/supabase.js`.
- Update data fetch/insert/delete flow in `src/App.jsx`.

### Change categories or UI behavior

- Category definitions and icon mapping are in `src/App.jsx`.
- Theme styles and layout are in `src/App.css` and `src/index.css`.

## Production Notes

- Gemini SDK loading is dynamically split to reduce initial bundle size.
- Large category image assets can still affect total download size. Consider converting PNG files in `src/assets` to WebP for smaller payloads.

## Docker

Docker is not required for this project.

This app runs as a standard frontend with environment variables and hosted services (Supabase + Gemini). If you later want containerized workflows, Docker can be added, but it is intentionally omitted here to keep setup simple.

## Troubleshooting

- Blank or failed network calls:
  - Verify `.env` variable names and values.
  - Restart dev server after changing `.env`.
- Scan fails:
  - Confirm `VITE_GEMINI_API_KEY` is valid and has access to the configured model.
- Save/delete fails:
  - Confirm Supabase table/function exist.
  - Verify Supabase RLS policies and anon key permissions.

## License

See `LICENSE`.
