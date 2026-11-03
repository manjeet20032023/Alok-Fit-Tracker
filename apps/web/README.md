# Alok Fit Tracker Web

React 19 + TypeScript + Vite application for the Alok Fit Tracker PWA.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Persistence and cloud setup

IndexedDB is managed by Dexie. Workouts, entries, measurements, goals, custom exercises, photos, personal records, and the sync outbox are stored locally. Apply the SQL migrations in order before cloud sync. Cardio entries can record optional speed in km/h. When signed in, photo blobs upload to the private Supabase bucket and are downloaded on another signed-in device.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the repository-root `.env` file for local development. Use only these public frontend values; never add a service-role key to the frontend.


## Additional Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
