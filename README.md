# ReceiptiFy

## Project Description
ReceiptiFy is a full-stack-style frontend web app (React + Vite) that scans receipts with Google Gemini, stores extracted data in Supabase, and visualizes expenses, reimbursements, and net out-of-pocket metrics across dashboard and analytics views.

The app supports user authentication, per-user data isolation, receipt upload and parsing, category-based summaries, time filters, and CSV export.

## Tech Stack
- React 19
- Vite 8
- Supabase (Auth, Database, Storage)
- Google Gemini API (via `@google/genai`)
- ESLint 9

## Languages & Frameworks
- JavaScript (ES Modules)
- JSX (React components)
- CSS
- SQL (Supabase schema and policies)
- Framework/Tooling: React + Vite

## APIs Used
- Supabase API (`@supabase/supabase-js`)
  - Auth: sign-up/sign-in/session
  - Postgres tables and RLS-secured CRUD
  - Storage bucket for receipt files/images
- Google Gemini API (`@google/genai`)
  - Receipt OCR-style extraction (store name, total, category, date)

## Core Features
- Email/password authentication
- Client-side login attempt throttling
- Per-user receipt access (`user_id` scoped)
- Receipt scanning and structured extraction with Gemini
- Expense vs reimbursement tracking
- Dashboard and analytics summaries
- CSV export
- Light/Dark theme toggle
- Profile/settings management

## Prerequisites
- Node.js 18+ (Node.js 20+ recommended)
- npm 9+
- Supabase project
- Google Gemini API key

## Environment Variables
Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

## Install Dependencies
Install all app dependencies:

```bash
npm install
```

Dependencies are defined in `package.json`.

### Runtime Dependencies
- `react`
- `react-dom`
- `@supabase/supabase-js`
- `@google/genai`
- `axios`

### Dev Dependencies
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

## Run the Web App
Start development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Lint source code:

```bash
npm run lint
```

## Supabase Setup (Required)
You need the following configured in Supabase:
- Auth enabled (Email provider at minimum)
- `profiles` table keyed by `auth.users.id`
- `receipts` table with `user_id` and reimbursement fields
- Row Level Security (RLS) policies scoped to `auth.uid()`

### SQL Migration (for existing projects)
Run this in Supabase SQL Editor:

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

## Project Structure
```text
src/
  App.jsx
  App.css
  index.css
  assets/
  components/
  lib/
    gemini.js
    supabase.js

## License
See `LICENSE`.
