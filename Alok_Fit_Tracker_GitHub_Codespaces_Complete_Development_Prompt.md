# Alok Fit Tracker — GitHub Codespaces Complete Development Prompt

Use this file as the master instruction for GitHub Codespaces AI coding agent (GitHub Copilot Chat/Agent mode). First inspect the existing repository; then implement every phase below in order. Do not rewrite or delete working code unnecessarily.

## 1. Product and non-negotiable requirements

Build **Alok Fit Tracker**, a responsive web application and installable PWA for Android and laptop. It must be offline-first, with local persistence and optional Supabase authentication/cloud sync.

User starter defaults (editable):
- Height: 180 cm
- Weight: 71 kg
- Goal: Lean muscular and athletic physique
- Training days: Monday–Friday
- Saturday/Sunday: Rest
- Target duration: 120–150 minutes per gym session

### Exact weekly weight-training split
| Day | Main weight training |
|---|---|
| Monday | Chest + Triceps |
| Tuesday | Back + Biceps |
| Wednesday | Legs + Shoulders |
| Thursday | Chest + Triceps |
| Friday | Back + Biceps |
| Saturday | Rest |
| Sunday | Rest |

### Critical: only ONE gym session per day
The user goes to the gym **once per day, early in the morning**. All exercise happens in this one visit. Do not create morning and evening workouts, and do not create separate cardio or abs sessions.

Every Monday–Friday, the same single workout record must contain:
1. Cardio every day: treadmill running, fast walking, incline walking and/or other cardio. Track duration, distance, speed/pace, incline/decline, activity type, optional user/device-provided heart rate and calories.
2. Abs & Core every day: exercises, sets, reps, timed duration, resistance/weight and notes.
3. Main weight training according to the weekly split: exercises, sets, reps, weights, rest and notes.
4. Optional warm-up, cooldown and stretching.

Default order may be warm-up → cardio → abs/core → weight training → cooldown, but allow reordering. These are sections inside **one workout**, with one workout ID, one overall stopwatch, one start action and one finish action. Rest between sets counts toward workout duration. Target total session length is 120–150 minutes, editable. Saturday and Sunday are rest days by default.

## 2. Coding-agent operating rules

1. Audit the repository before editing: inspect framework, routes, components, dependencies, data storage, tests and README.
2. Preserve existing functionality, code and user data. Do not perform a wholesale rewrite unless the repository is genuinely empty.
3. If the repo is empty, use a stable TypeScript stack such as React + Vite + TypeScript, Tailwind (or existing styling), React Router, Dexie/IndexedDB, Supabase JS, and a maintained PWA integration.
4. Work phase by phase. For each phase: describe planned changes, implement, run lint/type-check/tests/build, fix errors, update README, then proceed.
5. Keep the app runnable after every phase.
6. Every visible button/control must work. No fake buttons, fake charts or placeholder success messages.
7. Never fabricate workouts, sets, reps, weights, calories, heart rate, body fat, PRs or analytics. Use only user-entered or reliable device data. Label estimates clearly.
8. Never expose Supabase service-role keys in frontend code. Only public anon/publishable key may be used client-side, with RLS enabled.
9. A sync failure must never delete or overwrite local data.
10. Never mark a workout complete without the user's explicit finish/confirmation.
11. Use accessible labels, keyboard support, readable contrast, clear validation and helpful loading/empty/error/offline states.
12. Do not add duplicate dependencies if equivalent packages already exist.
13. Document assumptions and limitations honestly.

## 3. Recommended navigation and UI

Pages/modules:
- Welcome/Login/Local mode
- Profile and onboarding
- Dashboard
- Live Workout Logger
- Workout Plans / Weekly Split
- Exercise Library
- Workout History / Calendar
- Workout Detail / Summary
- Cardio history
- Abs & Core history
- Progression and Personal Records
- Body Measurements
- Progress Photos
- Reports & Analytics
- Goals
- Sync & Offline Status
- Settings
- Data Export & Backup

Mobile: compact bottom navigation for key destinations and menu for secondary pages. Desktop: sidebar. Design should be modern, clean, athletic, responsive, with light/dark mode, large gym-friendly tap targets and minimal clutter.

## 4. Detailed feature requirements

### A. Onboarding and profile
- Welcome screen and local-only mode.
- Optional Supabase sign-up/sign-in if configured.
- Editable height, weight, goal, training days, units and preferred workout duration.
- Defaults as specified above.
- Missing optional profile fields must not block use.

### B. Dashboard
Show today's date, planned focus/rest-day status, Start Workout, unfinished workout recovery, recent sessions, weekly session count/duration, cardio and abs/core completion, latest body-weight entries and sync/offline status. Derive everything from saved data. Show helpful empty states; do not invent streaks or stats.

### C. Live Workout Logger — highest priority
- Start one workout record for the local date, with UUID.
- Show Cardio, Abs & Core and Weight Training sections inside that same workout.
- Allow skip/edit/reorder; never mark a section completed unless user confirms/logs it.
- One overall workout stopwatch; rest timer is separate.
- Persist unfinished workout and restore after reload/reopen.
- Pause, Resume, Finish and Cancel/Discard actions; confirm discard and finish.
- Finishing saves a summary and local record immediately.

#### Stopwatch must be timestamp-based
Do not use JavaScript interval as source of truth. Persist:
`started_at`, `paused_at`, `last_resumed_at`, `total_paused_seconds`, `completed_at`, `duration_seconds`, `status`.
Calculate elapsed duration from timestamps on render/resume/reopen. It must remain correct if browser tab is backgrounded, phone is locked, JavaScript is suspended or app is reopened. Paused time is excluded; normal rest between sets counts. Never silently finish/discard an unfinished workout.

#### Weight training
For each exercise record name, muscle group, set number, reps, weight/unit, optional RPE/RIR, notes and completion state. Add/remove/reorder exercises and sets. Allow copying previous set values as a convenience but require confirmation before saving. Provide configurable rest timer presets (30/60/90/120/180 sec) and custom duration with start/pause/resume/reset/skip. Rest timer must not control the overall stopwatch.

#### Cardio section inside same workout
Activity type (treadmill run/walk, incline walk, outdoor run, cycling, elliptical, other), duration, distance, speed/pace, incline/decline, optional heart rate, calories only if supplied by user/device, and notes. Multiple cardio entries are allowed inside the same workout.

#### Abs & Core section inside same workout
Rep-based or time-based exercises; track name, sets, reps, duration, resistance/weight, notes and completion state. Multiple core exercises remain linked to the same workout ID.

#### Workout summary
Show total duration, cardio, abs/core and weight-training summaries. Calculate total sets/volume only if source data supports it. Allow edits before final confirmation. No invented calories or performance claims.

### D. Workout plans and exercise library
- Preload the exact split shown above.
- Cardio and abs/core recur Monday–Friday inside the same daily workout.
- Editable day plans, exercise lists, sequence, targets and rest days.
- Search/filter exercise library by muscle group/equipment/type.
- Built-in and user-created exercises; tracking type may be reps, time or distance.
- Planned exercises are suggestions and can be edited during workout.

### E. History
- Calendar/list of completed workouts, filters by date, weekday, muscle group and exercise.
- Detail page shows all sections of the single session.
- Dedicated cardio/core history views filter entries across workouts; they must not create duplicate standalone sessions.
- Edit/delete with confirmation; show unfinished workouts separately with Resume.

### F. Progression, PRs and goals
- Derive PRs only from actual logged data: heaviest weight, reps at weight, estimated 1RM (clearly labelled estimate), duration or distance.
- Explain calculations; allow correction/deletion.
- Conservative progression suggestion only when all prescribed working sets reach top of rep range with acceptable effort and no pain/form warning. Never auto-increase weight; user confirms/dismisses.
- Editable goals with target value/unit, start date, optional target date, pause/edit/archive. Progress only from recorded data.

### G. Measurements, photos and reports
- Dated weight, waist, chest, shoulders, arms, thighs, hips and custom measurements; units cm/in and kg/lb.
- Graph only actual entries; never fabricate/interpolate measurements.
- Progress photos private, with date/notes. Local-only storage must explain storage limits. Cloud photos require internet and private storage policies. Allow delete/export. Do not infer body fat or health conditions from photos.
- Weekly/monthly/custom reports: completed sessions, training duration, cardio minutes/distance, core frequency, sets per muscle group when data is sufficient, exercise trends, body measurements, PRs and planned-vs-completed. Explain insufficient data.

### H. Settings, offline status and export
- Theme, units, date/time display, workout target, default rest timer, weekly split and notification preferences (only if supported/permission granted).
- Sync center: online/offline, last successful sync, pending/failed items, retry, local/cloud status and manual Sync Now.
- Export workouts/exercises/plans/cardio/core/measurements/goals as JSON/CSV where appropriate. Import with validation and preview; never overwrite without confirmation. Provide backup/restore instructions.

## 5. Local-first data model

Use Dexie + IndexedDB, or preserve an equivalent existing local database. Suggested tables:
`profiles`, `workoutPlans`, `exercises`, `workouts`, `workoutExercises`, `workoutSets`, `cardioEntries`, `coreEntries`, `measurements`, `progressPhotos`, `goals`, `personalRecords`, `syncOutbox`, `syncMetadata`.

Use UUIDs, ISO timestamps, local date/timezone fields where needed, revisions and soft-delete tombstones. Use relational references between workout and its entries rather than one unstructured blob.

Example workout model:
```ts
type WorkoutStatus = "in_progress" | "paused" | "completed" | "abandoned";
interface Workout {
  id: string;
  localDate: string;
  timezone: string;
  plannedFocus: string[];
  status: WorkoutStatus;
  startedAt: string;
  pausedAt?: string | null;
  lastResumedAt?: string | null;
  totalPausedSeconds: number;
  completedAt?: string | null;
  durationSeconds?: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deletedAt?: string | null;
}
```

### Reliable sync
- Save local change first, then enqueue sync.
- Use outbox, stable UUIDs, idempotent operations, retry/backoff, revisions and tombstones.
- Retry on app launch, focus, network reconnect and manual request. Do not promise browser background sync always runs.
- Never delete local records after upload.
- Resolve conflicts safely; preserve both versions or ask user where needed. Never silently overwrite a newer workout.
- App must remain fully usable locally if Supabase is unconfigured or unavailable.

## 6. Supabase setup and security

Optional Supabase features: authentication, PostgreSQL sync, private photo storage, multi-device backup.

Frontend environment variables:
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Never put service-role key in frontend or commit secrets. If privileged backend work is required, keep secrets server-side only.

Create SQL migrations, indexes, foreign keys and `user_id` ownership fields. Enable RLS on every user-owned table; policies must enforce `auth.uid() = user_id`. Private photo bucket only, with owner-scoped policies. Never make progress photos public. Missing Supabase credentials must not crash local-only mode. Provide setup steps in README.

## 7. PWA and device behavior

- Installable PWA with manifest, icons and service worker.
- Cache app shell/essential assets for offline reopen after initial successful load.
- Responsive Android, tablet and laptop layouts.
- Restore active workout after refresh/reopen.
- No reliance on background JS intervals for stopwatch correctness.
- Explain PWA installation on Android and supported desktop browsers.
- Do not claim this automatically produces a native Android/iOS app.

## 8. Phased implementation — complete every phase

### Phase 0 — Repository audit and foundation
Inspect repo; report existing stack; preserve current code. Verify/set up TypeScript, routing, styling, app shell, responsive navigation, theme, env example and scripts. Add/update README.  
**Acceptance:** app starts and production build succeeds.

### Phase 1 — Local database and profile
Set up Dexie/IndexedDB with versioned migrations; profile onboarding/editing; local-only mode; exact weekly split; units and session duration settings. Add a data-access/service layer.  
**Acceptance:** profile and plan persist after refresh and are available offline after initial load.

### Phase 2 — Exercise library and workout plans
Build searchable/editable exercise library and weekly plan editor. Include weekday cardio and abs/core components inside one daily plan.  
**Acceptance:** user can edit plan/exercises; no duplicate sessions.

### Phase 3 — Live single-session workout logger
Implement Start Workout, timestamp-based stopwatch, pause/resume/reopen recovery, weight-training sets, independent rest timer and explicit finish confirmation.  
**Acceptance:** elapsed time survives reload/background; paused time excluded; unfinished session restores.

### Phase 4 — Cardio and Abs & Core
Add cardio and abs/core sections to the active workout. All entries share the same workout ID and overall stopwatch. Add editing, ordering and skip behavior.  
**Acceptance:** one workout contains Cardio + Abs & Core + Weight Training; no second workout is created.

### Phase 5 — Dashboard, history and details
Build real-data dashboard, calendar/list, filters, workout detail/summary and unfinished workout recovery. Add cardio/core history filters without duplicate sessions.  
**Acceptance:** displayed values derive from saved records and can be edited.

### Phase 6 — Progression, PRs and goals
Calculate PRs from real logs, add conservative user-confirmed suggestions, goals and progress charts.  
**Acceptance:** no fabricated PRs or automatic weight changes.

### Phase 7 — Measurements, photos and reports
Add measurements, private progress photos, reports and export.  
**Acceptance:** reports use real records; photo privacy and data export work.

### Phase 8 — Supabase authentication and schema
Add optional auth, migrations, ownership and RLS policies, private photo storage policies. Preserve local-only mode.  
**Acceptance:** app works without Supabase; cloud users can only access their own records.

### Phase 9 — Reliable offline/cloud sync
Implement outbox, idempotency, retry, revisions, tombstones, conflict handling and sync center.  
**Acceptance:** offline changes sync after reconnect; local data survives failures and conflicts.

### Phase 10 — PWA, accessibility, QA and release
Add manifest/service worker/icons, verify offline app shell, test mobile/desktop, accessibility and all critical flows. Update complete README and known limitations.  
**Acceptance:** installable responsive PWA; offline logging works after first load; production build and tests pass.

## 9. Required tests

Create/run tests for:
- Stopwatch start/pause/resume/reload/background/finish calculations.
- Paused time excluded; rest time included.
- In-progress workout restored and never silently completed.
- Each weekday workout has exactly one workout record containing cardio, core and weight-training sections.
- No evening or second daily workout generated.
- Saturday/Sunday default rest.
- Offline logging, reload persistence, reconnect sync, failed sync preserving local data.
- Conflict handling, retries and idempotency.
- Accurate unit conversion and report calculations.
- Export/import validation and duplicate protection.
- RLS isolation between users and private photo access.
- Mobile/desktop responsiveness, accessibility and working controls.

Run commands appropriate to the actual repo, for example:
```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```
Do not claim commands passed unless they were actually run.

## 10. README requirements

Maintain README with product overview, actual tech stack, setup, environment variables, Supabase setup/migrations, local-only mode, PWA install, offline/sync behavior and limitations, backup/export, test/build commands, phase checklist and known limitations.

## 11. Final instruction to the Codespaces agent

Start with repository audit. Do not immediately rewrite files. Implement phases in order and keep the app runnable after each phase. At the end of each phase, report files changed, features completed, commands/tests run, results and remaining work.

The critical rules must never be violated:
1. One early-morning gym visit and one workout session per training day.
2. Daily cardio + daily abs/core + that day's weight training all belong to that same session.
3. Split: Mon Chest+Triceps; Tue Back+Biceps; Wed Legs+Shoulders; Thu Chest+Triceps; Fri Back+Biceps; Sat/Sun Rest.
4. Session target 120–150 minutes, editable.
5. No evening workout; no separate cardio/abs session.
6. Offline-first local persistence; optional Supabase sync must not risk local data.
7. Timestamp-based stopwatch, correct after suspension/reopen.
8. No fabricated fitness data and no automatic completion.
