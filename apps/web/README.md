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

IndexedDB is managed by Dexie. The active workout, measurements, goals, custom exercises, photos, and sync outbox are stored locally. Apply the SQL migration from `supabase/migrations` before cloud sync.

Create `apps/web/.env.local` from the root `.env.example`. Use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never add a service-role key to this frontend.


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
