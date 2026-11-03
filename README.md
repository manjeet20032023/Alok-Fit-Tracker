# Alok Fit Tracker

Local-first fitness tracker PWA for one combined gym session per day. It includes a timestamp-based workout stopwatch, cardio, abs/core, strength sets, rest timer, history, measurements, goals, reports, exercise search/custom entries, private local photos, JSON/CSV export, and optional Supabase authentication/sync.

## Structure

```text
apps/web/                 React, TypeScript and PWA application
supabase/migrations/      PostgreSQL schema and owner-only RLS policies
Alok_Fit_Tracker_*.md     Product specifications
.env.example              Public frontend environment template
```

## Run locally

```bash
cd apps/web
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

## Security note

A Supabase secret/server key may not be placed in Vite frontend environment variables or source files. It has been removed from the workspace environment file and must be rotated in the Supabase dashboard if it was disclosed outside this environment. Use only the project URL and publishable/anon key in `.env`.

## Supabase setup

1. Create or open the project in the Supabase dashboard.
2. Run `supabase/migrations/202611030001_alok_fit_tracker.sql` in the SQL editor.
3. Enable Email authentication if desired.
4. Copy `.env.example` to `apps/web/.env.local` and enter the project URL and publishable key.
5. Restart Vite.

The migration creates user-owned workouts, entries, measurements, goals, exercises, and private photo metadata with `auth.uid()` RLS policies. The private `progress-photos` bucket and owner-scoped storage policies are also created.

## Local-first behavior

- IndexedDB is the immediate source of truth.
- Workout and entry writes save locally before optional sync.
- The stopwatch derives elapsed time from timestamps and excludes explicit paused intervals.
- Rest time remains counted unless the whole workout stopwatch is paused.
- Sync retry runs at launch, window focus, connectivity return, and manual Sync Now.
- Network or authentication failures retain local records and mark the outbox item failed.

## Data backup

Use Settings to export a JSON backup or workout-set CSV. Browser storage can still be lost if browser data is cleared or the device is lost. Cloud photo backup is not yet implemented; progress photos remain browser-local and private.

## Deploy on Render with GitHub

The repository includes `render.yaml` for a Render Static Site.

1. Commit and push all changes to the `main` branch on GitHub.
2. In Render, select **New > Blueprint**.
3. Connect GitHub repository `manjeet20032023/Alok-Fit-Tracker`.
4. Review the `alok-fit-tracker` static service created from `render.yaml`.
5. Enter the public Supabase values for:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Create the Blueprint and allow the first build to finish.

Render runs `cd apps/web && npm ci && npm run build` and publishes `apps/web/dist`. The `/*` rewrite sends React routes to the app. Later pushes to the connected branch trigger automatic redeploys. Supabase is the cloud backend for this architecture; no custom Render API is required.

Do not put a Supabase service-role or secret key in Render environment variables or frontend build variables.

## Remaining limitations

- No third-party gym-device integration.
- No automatic body-fat/health diagnosis.
- Photo metadata can be cloud-synced only after its private storage workflow is completed on a deployed backend.
- Two-device conflicts are detected for workouts by revision but some append-only entities do not yet have a conflict-resolution UI.
- Exercise/planned-program editing is still simpler than the full specification editor.
- Production deployment credentials, monitoring, and backup automation are environment-specific.

## Specs

The complete implementation specifications remain in the markdown files at the repository root.
