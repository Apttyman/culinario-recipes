# Culinario

A recipe and cooking companion app built with TanStack Start, React 19, Tailwind CSS v4, and Lovable Cloud (Supabase) for auth, database, and edge functions.

Live app: https://culinario-recipes.lovable.app

## Tech stack

- **Framework:** TanStack Start v1 (file-based routing, SSR) on Vite 7
- **UI:** React 19, Tailwind CSS v4, shadcn/ui (Radix primitives), lucide-react
- **Data:** TanStack Query, Zod, react-hook-form
- **Backend:** Lovable Cloud — Supabase auth, Postgres, and edge functions
- **Deploy target:** Cloudflare Workers (via `@cloudflare/vite-plugin`)

## Prerequisites

- Node.js 20+ (or Bun 1.1+)
- A package manager: `bun`, `npm`, or `pnpm`

## Setup

1. Clone the repo:
   ```bash
   git clone <your-repo-url>
   cd <repo-folder>
   ```
2. Install dependencies:
   ```bash
   bun install
   # or: npm install
   ```
3. Environment variables — the project expects a `.env` at the project root with:
   ```bash
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_PUBLISHABLE_KEY=...
   VITE_SUPABASE_PROJECT_ID=...
   ```
   When developing inside Lovable, this file is provisioned automatically by Lovable Cloud. For local-only development outside Lovable, copy the values from your Lovable Cloud project settings.

## Run locally

Start the dev server:
```bash
bun run dev
# or: npm run dev
```
The app runs at http://localhost:5173 by default.

## Other scripts

| Command | What it does |
|---|---|
| `bun run dev` | Start the Vite dev server with HMR |
| `bun run build` | Production build |
| `bun run build:dev` | Build in development mode |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format the project with Prettier |

## Project structure

```
src/
  routes/              # File-based routes (TanStack Router)
  components/          # UI components (incl. shadcn/ui in components/ui)
  lib/                 # Client utilities, auth context, Supabase client
  integrations/        # Auto-generated Supabase client + types
supabase/
  functions/           # Edge functions (detect-ingredients, generate-recipe, etc.)
  config.toml          # Supabase project config
```

## Backend

Backend (database, auth, edge functions) is managed through Lovable Cloud. Edge functions in `supabase/functions/*` deploy automatically on publish from Lovable.

## Deploy

Publish from the Lovable editor — this builds and deploys the app along with any edge function changes.