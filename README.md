# ReceiptiFy

A React + Vite web app that scans receipt images with Gemini AI, stores extracted records in Supabase, and provides a dashboard for tracking spending by category.

## Features

- Upload receipt images (JPEG/JPG/PNG)
- Extract store name, total amount, and category using Gemini
- Save and fetch receipts from Supabase
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

The app expects a table named `receipts` and an RPC function named `delete_receipt`.

### Minimum `receipts` table

```sql
create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  store_name text not null,
  total numeric(10,2) not null,
  category text,
  created_at timestamptz not null default now()
);
```

### RPC function used by the app

```sql
create or replace function public.delete_receipt(receipt_id bigint)
returns void
language sql
security definer
as $$
  delete from public.receipts where id = receipt_id;
$$;
```

If you use Row Level Security, ensure your policies allow the operations your users need (`select`, `insert`, and delete via RPC).

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
