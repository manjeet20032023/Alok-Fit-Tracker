# Alok Fit Tracker

Local-first fitness tracker PWA for one combined gym session per day. It includes a timestamp-based workout stopwatch, cardio, abs/core, strength sets, rest timer, editable history, measurements, goals, reports, exercise search/custom entries, personal records and progression suggestions, private progress photos, JSON/CSV export, and optional Supabase authentication/sync.

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
2. Run the migrations in order: `202611030001_alok_fit_tracker.sql`, `202611030002_alok_fit_tracker_hardening.sql`, `202611030003_workout_location.sql`, `202611030004_cardio_speed.sql`, then `202611030005_exercise_catalog_keys.sql`.
3. Enable Email authentication if desired.
4. Put the project URL and publishable key in the repository-root `.env` file. Vite loads this ignored local file for development and builds.
5. Restart Vite.

The migration creates user-owned workouts, entries, measurements, goals, exercises, and private photo metadata with `auth.uid()` RLS policies. The private `progress-photos` bucket and owner-scoped storage policies are also created.

## Local-first behavior

- IndexedDB is the immediate source of truth.
- Workout and entry writes save locally before optional sync.
- The stopwatch derives elapsed time from timestamps and excludes explicit paused intervals.
- Rest time remains counted unless the whole workout stopwatch is paused.
- Authenticated sync reconciles supported records in both directions at launch, window focus, connectivity return, and manual Sync Now.
- Network or authentication failures retain local records and expose retry status; workout revision conflicts offer explicit local/cloud resolution in History.

## Data backup

Use Settings to export a JSON backup or workout-set CSV. JSON backups include personal records and image data for progress photos. When Supabase is configured and the user is signed in, progress photos upload to the private `progress-photos` bucket; without cloud configuration they remain browser-local. Browser storage can still be lost if browser data is cleared or the device is lost.

## Deploy on Render with GitHub

The repository includes `render.yaml` for a Render Static Site. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build environment variables in Render. For Cloudflare Pages, set the same variables in the Pages project settings; `wrangler.toml` configures only the build output directory. Both hosts build these public values into the frontend bundle, so never use a service-role key.

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
- Real email-confirmation sign-up and authenticated production insert/update flows still need an operator-run test against the configured Supabase project.
- Workout conflicts have a resolution UI; other entity types currently use timestamp-based reconciliation rather than per-record conflict choices.
- Exercise/planned-program editing is still simpler than the full specification editor.
- Hosted Render and Cloudflare environment settings, monitoring, and backup automation are deployment-specific and must be checked in their dashboards.

## Specs

The complete implementation specifications remain in the markdown files at the repository root.
