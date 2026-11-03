# Alok Fit Tracker

## Complete Development Specification & Phased GitHub Implementation Prompts

**Product name:** Alok Fit Tracker\
**Product type:** Offline-first, installable Progressive Web App (PWA)
and responsive website\
**Platforms:** Android/iOS mobile browsers, installable PWA where
supported, laptop/desktop browsers\
**Storage model:** Local-first IndexedDB + automatic cloud
synchronization\
**Tracking level:** Complete workout, strength, cardio, abs/core, body
measurements, progress photos, rest timer, recommendations, and reports

------------------------------------------------------------------------

# 1. Product vision

Build a personal fitness tracking system that makes it easy to record
every workout set and cardio session, compare performance with previous
sessions, understand long-term progress, and make safe, evidence-based
progression decisions.

The application must work when the internet is unavailable. A user must
be able to open the installed app, start a workout, record exercises,
sets, reps, weights, cardio, and notes offline. Data must be saved
locally immediately and synchronized with the cloud when connectivity
returns.

This is a personal tracker, not a social fitness network. Prioritize
fast data entry, reliability, privacy, and useful progress analysis over
unnecessary social features.

## Primary outcomes

1.  Record exactly what was performed: exercise, equipment, sets, reps,
    weight, duration, distance, incline, resistance, rest, RPE/RIR, and
    notes.
2.  Show the previous performance beside the current exercise entry.
3.  Track progress per exercise and muscle group across weeks and
    months.
4.  Recommend a sensible next target without automatically forcing a
    weight increase.
5.  Track cardio, abs/core, body weight, body measurements, and progress
    photos.
6.  Generate weekly and monthly reports.
7.  Work offline and synchronize safely without losing or duplicating
    records.
8.  Allow export and restore of personal data.

## Non-goals for the first release

-   No public user profiles, leaderboards, social feed, or messaging.
-   No medical diagnosis, body-fat diagnosis, or guaranteed physique
    predictions.
-   No automatic connection to gym machines or wearables in the MVP.
-   No AI-generated medical or injury advice.
-   No automatic workout changes without user confirmation.

------------------------------------------------------------------------

# 2. Recommended technology architecture

Use a TypeScript-first architecture with clear separation between UI,
local persistence, domain logic, synchronization, and server APIs.

  -----------------------------------------------------------------------
  Layer                   Recommended technology  Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                React + TypeScript +    Responsive web
                          Vite                    application

  UI                      Tailwind CSS +          Consistent mobile-first
                          accessible component    interface
                          library                 

  Routing                 React Router            App navigation

  Local database          IndexedDB via Dexie     Offline-first workout
                                                  and profile data

  PWA                     `vite-plugin-pwa` +     Installability, app
                          Workbox                 shell caching, offline
                                                  launch

  Client state            TanStack Query +        Server state and
                          lightweight UI state    interface state
                          (e.g. Zustand)          

  Backend                 Node.js + TypeScript +  Authentication, sync,
                          Express                 reports, photo metadata

  API validation          Zod                     Validate all client and
                                                  server payloads

  Cloud database          PostgreSQL              Durable multi-device
                                                  data storage

  ORM/migrations          Prisma                  Schema management and
                                                  database access

  Photo storage           S3-compatible object    Private progress-photo
                          storage                 files

  Charts                  Recharts or another     Progress graphs
                          maintained React chart  
                          library                 

  Testing                 Vitest, React Testing   Unit, integration, and
                          Library, Playwright     end-to-end tests

  Deployment              Cloudflare Pages        Production hosting
                          (frontend) + Render     
                          (API) + managed         
                          PostgreSQL              
  -----------------------------------------------------------------------

The implementation may use an equivalent managed backend if it satisfies
the same requirements. Do not introduce multiple competing databases or
duplicate sources of truth.

## High-level architecture

``` text
Mobile PWA / Desktop Browser
          |
          +--> React UI
          |
          +--> Domain services
          |      - workout calculations
          |      - progression recommendations
          |      - report aggregation
          |
          +--> IndexedDB (Dexie)
          |      - immediate local writes
          |      - pending sync queue
          |      - cached reference data
          |
          +--> Sync engine <------ connectivity / retry
                    |
                    v
             HTTPS Backend API
                    |
          +---------+----------+
          |                    |
       PostgreSQL        Private object storage
       user/workouts     progress photos
       measurements      signed upload/download
       sync metadata
```

## Critical architecture rule

**IndexedDB is the immediate source of truth for the active device.**
Every user action that records workout data must save locally first. The
UI must not wait for the server before confirming that an offline
workout entry has been saved.

The cloud database becomes the synchronized durable copy and enables
backup and multi-device access.

------------------------------------------------------------------------

# 3. User experience and navigation

Use a clean, modern fitness interface. Dark mode may be the default, but
provide a light theme. Make the mobile workout-entry experience
especially fast: large tap targets, minimal typing, numeric keypad for
numbers, and clear save state.

## Main navigation

1.  **Dashboard**
2.  **Workout Planner**
3.  **Start Workout / Workout Logger**
4.  **Exercise Library**
5.  **Cardio Tracker**
6.  **Abs & Core**
7.  **Strength Progress**
8.  **Body Measurements**
9.  **Progress Photos**
10. **Reports**
11. **Workout History**
12. **Settings & Backup**

On mobile, use a bottom navigation for the most-used areas (Dashboard,
Workout, History, Reports) and a menu for the rest. On desktop, use a
collapsible sidebar.

## Dashboard widgets

-   Today's planned workout and a Start Workout action.
-   Last workout summary.
-   Weekly workout consistency.
-   Sessions completed this week/month.
-   Total training volume (clearly label the calculation).
-   Cardio minutes and distance.
-   Abs/core sessions.
-   Current body weight and latest measurement date.
-   Recent personal records.
-   Pending sync count and last successful sync time.
-   A small weekly activity calendar.

Do not display invented sample values as real user data. Empty states
should explain how to start recording data.

## Workout Planner

Allow users to create and edit weekly templates. Provide a starter
Monday-Friday template, but make all days, muscle groups, exercises, and
rest days editable.

Suggested starter split (editable): - Monday: Chest + Triceps - Tuesday:
Back + Biceps - Wednesday: Legs + Abs/Core - Thursday: Shoulders +
Traps - Friday: Custom / Weak points / Full-body accessories - Saturday
and Sunday: Rest or optional activity

Do not force this split. The user must be able to change exercise order,
add/remove exercises, duplicate a day, and create multiple templates.

## Workout Logger

For every exercise show: - Exercise name and equipment. - Target
sets/reps, if defined by the plan. - Last session's sets, weights, and
reps. - Suggested next target, with explanation. - Current set rows. -
Add set, remove set, mark set complete. - Weight unit (kg by default;
support lb). - Reps or duration, as appropriate. - RPE and/or RIR
(optional). - Rest timer. - Exercise notes and workout notes. - Save
status: Saved on device / Waiting to sync / Synced.

The user must be able to edit a workout after completion. Keep an
audit-friendly updated timestamp and sync state.

## Exercise library

Each exercise should have: - Name and optional alternative names. -
Muscle groups (primary and secondary). - Equipment. - Movement pattern
(push, pull, hinge, squat, carry, core, cardio). - Exercise type
(strength, bodyweight, timed, distance, cardio). - Default unit and
optional rep range. - Instructions and safety/form notes (editable). -
Active/inactive status.

Include common exercises as starter seed data, but allow custom
exercises. Avoid presenting form instructions as medical advice.

------------------------------------------------------------------------

# 4. Detailed workout data capture

## Strength training fields

At workout level: - Workout date and start/end time. - Planned
template/day. - Session status: in progress, completed, abandoned. -
Overall effort (optional RPE). - General notes. - Device-created
timestamp and last-updated timestamp.

At exercise level: - Exercise ID and display-name snapshot. - Order in
workout. - Primary/secondary muscle groups snapshot. - Exercise notes. -
Completion status.

At set level: - Set number and set type (warm-up, working, drop,
failure, AMRAP, timed). - Weight and unit. - Reps. - Duration (for timed
holds). - Distance (when applicable). - RPE (1-10) and/or RIR (0-10),
optional. - Completed/skipped status. - Timestamp.

Support bodyweight exercises and assisted exercises. For assisted
pull-ups/dips, clearly define whether the recorded load is assistance
weight or added weight. Do not combine incompatible units in the same
calculation.

## Training volume

For ordinary weighted sets, calculate volume as:

`set_volume = weight_kg × reps`

`exercise_volume = sum(completed working-set volumes)`

`workout_volume = sum(exercise volumes)`

For bodyweight exercises, do not invent the user's bodyweight as lifted
load unless the user explicitly enables that calculation. Show
bodyweight reps separately.

For unilateral movements, record whether reps are per side or total. Do
not silently double reps.

Volume is a tracking metric, not a complete measure of workout quality.
Display it alongside sets, reps, exercise performance, and effort.

------------------------------------------------------------------------

# 5. Cardio tracker

Support these activity types: - Treadmill running - Treadmill walking -
Incline walking - Decline walking (only if the machine supports it) -
Outdoor walking/running - Cycling / stationary bike - Stair climber -
Elliptical - Rowing machine - Other/custom cardio

Fields: - Activity type. - Date/time. - Duration (minutes and
seconds). - Distance and unit. - Average speed (calculated where
possible). - Incline/decline percentage or machine level. -
Resistance/level. - Calories (optional, user-entered or device-provided;
label as estimate/source). - Average heart rate (optional). - Notes.

Calculations: - Pace = duration / distance when distance is known. -
Average speed = distance / duration. - Weekly/monthly cardio duration
and distance. - Keep machine-reported calories clearly distinguished
from measured values.

Do not infer distance, calories, heart rate, or incline when they were
not entered.

------------------------------------------------------------------------

# 6. Abs & core tracker

Abs/core exercises should use the same exercise and set model where
possible, with suitable input modes: - Reps × sets: crunches, bicycle
crunches, Russian twists. - Timed: plank, side plank, hollow hold. -
Weighted: cable crunch, weighted sit-up. - Distance/time if a future
core conditioning exercise needs it.

Track: - Exercise. - Sets. - Reps or hold duration. - Added weight, if
any. - RPE/RIR (optional). - Notes. - Completed/skipped status.

Abs/core workouts must appear in workout history and weekly/monthly
reports without being double-counted as separate gym sessions if they
were part of an existing workout.

------------------------------------------------------------------------

# 7. Workout progression and automatic recommendations

The app should provide **recommendations, not commands**. The user
always confirms the next target.

## Recommended progression model

Allow each exercise to have: - Minimum target reps. - Maximum target
reps. - Planned working sets. - Current working weight. - Increment step
(e.g. 1 kg, 1.25 kg, 2.5 kg; user-editable). - Progression method:
double progression, fixed reps, timed progression, manual. - Optional
RPE/RIR target.

### Double progression example

If the target is 3 sets of 8-12 reps at 10 kg:

-   Week/session A: 10 kg × 12, 10, 9 → maintain 10 kg.
-   Next session: 10 kg × 12, 11, 10 → maintain 10 kg.
-   Next session: 10 kg × 12, 12, 12 → eligible to consider a small
    increase.
-   Next session target: increase by the smallest practical increment,
    then aim for the lower end of the rep range.

Only recommend an increase if: 1. All prescribed working sets reached
the top of the rep range. 2. Sets were marked completed. 3. The user did
not flag pain, poor form, or an unusually difficult session. 4. RPE/RIR,
if entered, is within the user's configured effort limit. 5. The
increment is available and appropriate for that exercise.

If the user misses reps: - Recommend maintaining the same load in the
next session. - Show the exact set/reps comparison. - Do not
automatically reduce load after one weaker day. - If performance falls
repeatedly, flag a review rather than prescribing a medical or training
diagnosis.

### Recommendation examples

-   **Maintain:** "Last time: 10 kg --- 12, 10, 9. Target: try to match
    or improve reps at 10 kg."
-   **Eligible to increase:** "Last time: 10 kg --- 12, 12, 12. You
    reached the top of your 8--12 range. Consider 11 kg next time if
    form remains controlled."
-   **Repeat / review:** "You completed fewer reps than last session.
    Keep the same load and focus on controlled reps."
-   **Insufficient data:** "Complete another session to establish a
    useful comparison."

Do not recommend a large jump. Use the smallest practical increment. For
dumbbells, barbells, machines, and cables, increments may differ;
configure them per exercise/equipment.

## Estimated strength

Optionally calculate estimated 1-rep max using a clearly labelled
estimate (e.g. Epley formula) only for suitable conventional weighted
sets:

`estimated_1RM = weight × (1 + reps / 30)`

Limit use to a configurable rep range (for example 1--10) and avoid
presenting it as an actual tested max. Do not compare estimates across
different exercises or machines as if they were equivalent.

## Progress indicators

-   Best weight for a given rep count.
-   Best reps at a given weight.
-   Best completed working-set volume.
-   Estimated 1RM trend (where supported).
-   Total working sets.
-   Consistency of sessions.
-   Muscle-group training frequency.

Recommendations must be deterministic, explainable, unit-tested, and
versioned so a future algorithm change does not silently rewrite
historical recommendations.

------------------------------------------------------------------------

# 8. Body measurements and progress photos

## Body measurements

Allow configurable measurements: - Body weight (kg/lb). - Waist. -
Chest. - Shoulders. - Upper arm (left/right, relaxed/flexed optional). -
Forearm (left/right). - Thigh (left/right). - Calf (left/right). -
Neck. - Hips. - Optional user-defined measurement.

Each record stores: - Measurement type. - Value and unit. - Measurement
date/time. - Optional note. - Source (manual/device). - Created/updated
timestamp.

Show trends over 4, 8, 12 weeks and custom date ranges. Never imply that
a measurement change is necessarily muscle gain or fat loss.

## Progress photos

-   Allow front, side, back, and custom photo categories.
-   Capture/upload from mobile or desktop.
-   Store files in private object storage; store metadata in PostgreSQL.
-   Use signed, short-lived upload/download URLs.
-   Photos must not be public or accessible through guessable permanent
    URLs.
-   Provide delete and export options.
-   Display a privacy warning before first upload.
-   Do not use photos for automated body-fat or health diagnosis.
-   Consider optional local-only photo storage as a future enhancement.

------------------------------------------------------------------------

# 9. Reports and analytics

## Weekly report

Use a user-configurable week start day. Include: - Sessions planned vs
completed. - Workout days and rest days. - Exercises completed. - Total
working sets and reps. - Total weighted training volume (with
definition). - Per-exercise progress highlights. - Muscle-group session
frequency. - Cardio minutes and distance by type. - Abs/core sessions
and total work. - Body-weight/measurement change only if at least two
comparable records exist. - Personal records. - Skipped
sessions/exercises. - Sync status and data completeness.

## Monthly report

Include: - Sessions completed and consistency percentage. - Week-by-week
activity. - Strength trend for selected exercises. - Volume trend by
muscle group. - Cardio minutes/distance trend. - Body measurement
trend. - New personal records. - Most consistent workout days. -
Exercises with no recent records. - User notes and next-month focus.

## Report rules

-   Do not interpret missing entries as zero performance.
-   Distinguish "no data" from "zero".
-   Use the user's timezone for date boundaries.
-   Let the user select a date range.
-   Allow CSV export for workout sets, cardio, measurements, and
    reports.
-   Provide a printable report or PDF export as a later enhancement.
-   Avoid misleading percentage changes when the previous value is zero
    or missing.

------------------------------------------------------------------------

# 10. Offline-first architecture and synchronization

This is a core requirement, not a later optional enhancement.

## Local-first write flow

1.  User records a set or measurement.
2.  Validate the input on the client.
3.  Write it to IndexedDB in a transaction.
4.  Update the screen immediately.
5.  Mark the record as `pending_sync`.
6.  When online, send pending changes to the API.
7.  Server validates ownership and payload.
8.  Server upserts using stable IDs and idempotency keys.
9.  Server returns accepted versions and server timestamps.
10. Client marks accepted records as `synced`.

If the API is unavailable, keep the local record and retry later. Never
discard a local record because a request failed.

## IndexedDB stores

At minimum: - users/profile cache - workout_templates -
workout_sessions - workout_exercises - workout_sets - exercise_library -
cardio_sessions - measurements - progress_photo_metadata - sync_queue -
sync_metadata - app_settings

Use Dexie migrations. Do not delete or recreate the database on
application upgrades.

## Sync metadata

Each mutable record should include: - `id` (UUID generated on client) -
`user_id` - `created_at` - `updated_at` - `deleted_at` (nullable
tombstone) - `client_id` / device identifier - `client_version` or
revision - `sync_status` (local-only, pending, synced, conflict, failed)

Do not rely only on device timestamps to resolve conflicts.

## Conflict handling

-   Use stable UUIDs and idempotent upserts.
-   Use server revision/version numbers.
-   For records changed on one device only, sync normally.
-   If the same record changed on multiple devices, detect a conflict.
-   Prefer preserving both versions or presenting a conflict resolution
    UI for important records; do not silently overwrite workout sets.
-   For append-only workout sets, use unique IDs so concurrent additions
    do not collide.
-   Deletions should use tombstones and sync to other devices.
-   Retain enough sync metadata to prevent deleted records from
    reappearing.

## Retry and reliability

-   Retry transient failures with exponential backoff and jitter.
-   Do not retry permanent validation/authorization errors indefinitely.
-   Show pending, syncing, synced, and error states.
-   Add a manual "Sync now" action.
-   Resume sync after app launch and when connectivity returns.
-   Do not assume the browser's online indicator guarantees API
    availability; confirm with an actual API request.
-   Background Sync may be unavailable on some browsers. Always provide
    foreground retry on app launch, focus, and manual action.
-   Do not promise that a closed browser will always sync in the
    background.

## Offline limitations to communicate

-   First installation and initial app-shell caching require an internet
    connection.
-   Cloud backup and multi-device sync require internet.
-   The app must remain usable for core workout entry offline after
    successful initial load.
-   Photo uploads can be queued offline, but the actual upload occurs
    when connectivity returns.
-   If local browser storage is cleared or the device is lost before
    sync/export, unsynced data may be lost. Provide visible backup/sync
    status and export tools.

------------------------------------------------------------------------

# 11. Data model

Use UUID primary keys. Store timestamps in UTC and render them in the
user's configured timezone. Store numeric values in consistent base
units (kg, meters, seconds) and convert only for display.

## Core relational entities

### UserProfile

-   id
-   email / auth subject
-   display_name
-   timezone
-   preferred_weight_unit
-   preferred_distance_unit
-   week_starts_on
-   theme
-   created_at
-   updated_at

### Exercise

-   id
-   owner_user_id (nullable for shared seed exercises)
-   name
-   primary_muscle_groups
-   secondary_muscle_groups
-   equipment
-   movement_pattern
-   exercise_type
-   default_unit
-   instructions
-   is_active
-   created_at
-   updated_at

### WorkoutTemplate

-   id
-   user_id
-   name
-   day_label
-   sort_order
-   is_active
-   created_at
-   updated_at

### WorkoutTemplateExercise

-   id
-   template_id
-   exercise_id
-   sort_order
-   target_sets
-   min_reps
-   max_reps
-   progression_method
-   increment_kg
-   target_rpe
-   notes

### WorkoutSession

-   id
-   user_id
-   template_id (nullable)
-   workout_date
-   started_at
-   completed_at
-   status
-   overall_rpe
-   notes
-   created_at
-   updated_at
-   deleted_at
-   revision

### WorkoutExercise

-   id
-   session_id
-   exercise_id (nullable for deleted/custom snapshot)
-   exercise_name_snapshot
-   sort_order
-   notes
-   status
-   created_at
-   updated_at
-   deleted_at
-   revision

### WorkoutSet

-   id
-   workout_exercise_id
-   set_number
-   set_type
-   weight_kg (nullable)
-   reps (nullable)
-   duration_seconds (nullable)
-   distance_meters (nullable)
-   load_type (external, bodyweight, assisted, added_weight)
-   reps_per_side (boolean)
-   rpe (nullable)
-   rir (nullable)
-   status
-   completed_at
-   created_at
-   updated_at
-   deleted_at
-   revision

### CardioSession

-   id
-   user_id
-   workout_session_id (nullable)
-   activity_type
-   duration_seconds
-   distance_meters (nullable)
-   speed_kmh (nullable)
-   incline_percent (nullable)
-   machine_level (nullable)
-   resistance_level (nullable)
-   calories (nullable)
-   calories_source (nullable)
-   average_heart_rate (nullable)
-   notes
-   started_at
-   created_at
-   updated_at
-   deleted_at
-   revision

### Measurement

-   id
-   user_id
-   measurement_type
-   value
-   unit
-   measured_at
-   note
-   created_at
-   updated_at
-   deleted_at
-   revision

### ProgressPhoto

-   id
-   user_id
-   storage_key
-   category
-   captured_at
-   note
-   content_type
-   file_size_bytes
-   created_at
-   updated_at
-   deleted_at
-   revision

### ExerciseProgressionSetting

-   id
-   user_id
-   exercise_id
-   min_reps
-   max_reps
-   target_sets
-   increment_kg
-   progression_method
-   max_target_rpe
-   enabled
-   updated_at

### ProgressionRecommendation

-   id
-   user_id
-   exercise_id
-   based_on_session_id
-   algorithm_version
-   recommendation_type
-   current_load_kg
-   suggested_load_kg
-   suggested_rep_min
-   suggested_rep_max
-   explanation
-   created_at
-   accepted_at (nullable)
-   dismissed_at (nullable)

### SyncChange / Sync metadata

-   id
-   user_id
-   entity_type
-   entity_id
-   operation
-   revision
-   client_id
-   created_at
-   processed_at
-   result_status

Add indexes for user/date, session/exercise, exercise/date, and sync
lookup patterns. Use database constraints for valid statuses and
non-negative numeric fields where appropriate.

------------------------------------------------------------------------

# 12. API outline

All authenticated routes must enforce ownership. Never trust a user ID
supplied in a request body when the authenticated identity is available
from the session/token.

Suggested endpoints:

``` text
GET    /api/v1/me
PATCH  /api/v1/me

GET    /api/v1/exercises
POST   /api/v1/exercises
PATCH  /api/v1/exercises/:id

GET    /api/v1/workout-templates
POST   /api/v1/workout-templates
PATCH  /api/v1/workout-templates/:id
DELETE /api/v1/workout-templates/:id

GET    /api/v1/workouts?from=&to=
POST   /api/v1/workouts
GET    /api/v1/workouts/:id
PATCH  /api/v1/workouts/:id
DELETE /api/v1/workouts/:id

POST   /api/v1/sync/push
GET    /api/v1/sync/pull?cursor=
POST   /api/v1/sync/ack

GET    /api/v1/cardio
POST   /api/v1/cardio
PATCH  /api/v1/cardio/:id

GET    /api/v1/measurements
POST   /api/v1/measurements
PATCH  /api/v1/measurements/:id

POST   /api/v1/photos/upload-url
POST   /api/v1/photos/confirm
GET    /api/v1/photos
DELETE /api/v1/photos/:id

GET    /api/v1/reports/weekly?week=
GET    /api/v1/reports/monthly?month=

GET    /api/v1/export
POST   /api/v1/import/validate
POST   /api/v1/import
```

The sync API should support batches, stable IDs, idempotency, cursors,
revision checks, and partial success. Return per-record results so one
invalid item does not block every valid item in a batch.

------------------------------------------------------------------------

# 13. Security, privacy, and data protection

-   Use a reputable authentication provider or secure email/password
    authentication with properly hashed passwords.
-   Use secure, HttpOnly, SameSite cookies where the architecture
    supports them; protect state-changing requests against CSRF.
-   Enforce authorization on every API route and every database query.
-   Validate all inputs server-side with Zod or equivalent.
-   Use parameterized queries/ORM methods.
-   Keep secrets only in server-side environment variables. Never put
    database credentials, storage secrets, or private API keys in
    frontend code or Git.
-   Use HTTPS in production.
-   Restrict CORS to the deployed frontend origin.
-   Rate-limit authentication, sync, and upload endpoints.
-   Limit photo file type and size; verify actual content type, not just
    extension.
-   Use private object storage and short-lived signed URLs.
-   Provide account data export and account deletion.
-   Do not use fitness photos or personal data for model training or
    analytics without explicit consent.
-   Avoid collecting unnecessary sensitive data.
-   Add a privacy policy before public release.

------------------------------------------------------------------------

# 14. Accessibility, responsive design, and usability

-   Mobile-first layouts with large touch targets.
-   Keyboard-accessible desktop forms.
-   Proper labels, focus states, and screen-reader names.
-   Sufficient contrast in dark and light themes.
-   Do not rely only on color to communicate status.
-   Use clear units next to every measurement.
-   Keep workout entry usable with one hand where practical.
-   Provide undo for accidental deletion.
-   Warn before leaving an in-progress workout with unsaved local
    changes (although local writes should already be saved).
-   Avoid excessive modal dialogs.
-   Provide empty states and helpful validation errors.

------------------------------------------------------------------------

# 15. Development phases and acceptance criteria

Develop in the following phases. Each phase must be implemented, tested,
documented, and committed before moving to the next. Do not skip
requirements from earlier phases.

## Phase 0 --- Repository foundation and product design

Deliver: - GitHub repository structure. - Architecture decision
record. - React/Vite/TypeScript setup. - Linting, formatting,
environment examples. - Responsive design tokens and app shell. -
Navigation and empty-state pages. - CI workflow for lint, type-check,
and tests.

Acceptance: - App runs locally using documented commands. - No secrets
committed. - Desktop and mobile layouts render. - CI passes.

## Phase 1 --- Exercise library, templates, and local database

Deliver: - Dexie IndexedDB schema and migrations. - Seed exercise
library. - Custom exercise CRUD. - Workout template CRUD. - Editable
Monday-Friday starter split. - Local profile/settings. - Offline-first
repository/service layer.

Acceptance: - Create/edit/delete custom exercises and templates
offline. - Refreshing or restarting the browser preserves records. -
Database migration tests pass. - No backend required for core local
operations.

## Phase 2 --- Workout logger and history

Deliver: - Start, pause/resume, complete, and abandon workout flows. -
Exercise list and set editor. - Previous-session comparison. -
Weight/reps/RPE/RIR/rest timer. - Working, warm-up, drop, and timed set
types. - Workout history and edit flow. - Local persistence on every
action.

Acceptance: - A complete workout can be recorded with internet
disabled. - Every set has a stable UUID. - App restart does not lose the
active workout. - Incorrect inputs are blocked with clear messages. -
Rest timer works while navigating within the app.

## Phase 3 --- Cardio and abs/core

Deliver: - Cardio activity forms and history. - Incline/decline, speed,
time, distance, resistance, optional calories and heart rate. - Abs/core
exercise modes: reps, timed holds, weighted sets. - Weekly totals and
history filters.

Acceptance: - Cardio pace/speed calculations are unit-tested. - Missing
values remain null, not zero. - Abs/core attached to a workout are not
double-counted as separate sessions. - All entries work offline.

## Phase 4 --- Progression engine and personal records

Deliver: - Per-exercise progression settings. - Double progression
recommendation engine. - Maintain/increase/review/insufficient-data
states. - Increment configuration per exercise. - Recommendation
explanation and user accept/dismiss. - Optional estimated 1RM. - PR
detection.

Acceptance: - Recommendations are deterministic and unit-tested. - No
increase is recommended when top-of-range reps are not achieved on all
prescribed sets. - Pain/poor-form flags suppress increase
recommendations. - Historical data is not rewritten when algorithm
versions change. - User can override any recommendation.

## Phase 5 --- Measurements, photos, and reports

Deliver: - Body measurement tracker and graphs. - Private progress photo
upload and gallery. - Weekly and monthly reports. - Date-range
filters. - CSV export. - Printable report if practical.

Acceptance: - Measurements retain units and timestamps. - Photos are
private and deletion removes metadata and stored object. - Reports
distinguish missing data from zero. - Weekly/monthly boundaries respect
user timezone. - CSV export contains the user's selected date range
only.

## Phase 6 --- Backend, authentication, and cloud database

Deliver: - TypeScript API service. - PostgreSQL schema and Prisma
migrations. - Authentication and user profile. - Ownership
enforcement. - CRUD APIs for workouts, cardio, measurements, templates,
exercises. - Health check and structured logging.

Acceptance: - User A cannot read or modify User B's records. - Database
migrations run from a clean database. - API validation and authorization
tests pass. - Secrets are not exposed to the browser. - Local-only mode
still works if the API is unavailable.

## Phase 7 --- Sync engine and conflict resolution

Deliver: - Push/pull sync protocol. - Sync queue and retry logic. -
Idempotent upserts and revision checks. - Tombstone deletion sync. -
Conflict detection and user-facing resolution where necessary. - Manual
Sync Now and sync status display.

Acceptance: - Replaying the same sync batch does not duplicate data. -
Offline-created records sync after reconnect. - Two-device edits do not
silently overwrite workout sets. - Failed network requests retain local
data. - Partial batch failures are reported per record. - Sync can
resume after app restart.

## Phase 8 --- PWA, deployment, hardening, and release

Deliver: - PWA manifest, icons, service worker, app-shell caching. -
Offline launch and offline route support. - Cloudflare Pages frontend
deployment. - Render or equivalent API deployment. - Managed PostgreSQL
and private object storage. - Monitoring, backup, restore, privacy
policy, release checklist.

Acceptance: - Installed app launches after a successful first load with
internet disabled. - Core workout logging works offline. - Pending sync
is visible and recovers after reconnect. - No private photo URL is
publicly accessible. - Production smoke tests pass on Android Chrome and
desktop browsers. - Backup and restore are tested before release.

------------------------------------------------------------------------

# 16. Required testing strategy

## Unit tests

-   Volume calculations.
-   Unit conversion.
-   Pace and speed calculations.
-   Double progression rules.
-   PR detection.
-   Estimated 1RM boundaries.
-   Weekly/monthly date boundaries.
-   Null vs zero handling.
-   Input validation.

## IndexedDB tests

-   Create/read/update/delete records.
-   Schema migration from each prior version.
-   Transaction rollback.
-   Active workout persistence.
-   Pending sync queue persistence.
-   Tombstone behavior.

## API/integration tests

-   Authentication required.
-   User ownership enforcement.
-   Invalid payload rejection.
-   Duplicate idempotency key handling.
-   Sync cursor behavior.
-   Revision conflict handling.
-   Photo upload authorization.
-   Export scoping.

## End-to-end tests

1.  Install/open app after initial load.
2.  Disable internet.
3.  Start Monday workout.
4.  Add bench press sets and reps.
5.  Add incline walking and plank.
6.  Close/reopen app.
7.  Confirm all data remains.
8.  Re-enable internet.
9.  Trigger sync.
10. Confirm data appears on another signed-in device.
11. Edit a set on both devices and verify conflict handling.
12. Export CSV and verify contents.

## Performance and reliability

-   Workout logger should feel responsive on a mid-range Android phone.
-   Avoid loading the entire workout history at once.
-   Paginate history and use indexed queries.
-   Compress/resize progress photos client-side where practical,
    preserving the original only if user chooses.
-   Test poor connectivity, timeouts, API errors, expired sessions, and
    storage quota errors.
-   Show a warning if local storage is close to quota or a photo cannot
    be saved.

------------------------------------------------------------------------

# 17. Suggested GitHub repository structure

``` text
alok-fit-tracker/
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── .gitignore
├── .env.example
├── docs/
│   ├── PRODUCT_SPEC.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API_SPEC.md
│   ├── SYNC_PROTOCOL.md
│   ├── SECURITY_PRIVACY.md
│   ├── TEST_PLAN.md
│   └── phases/
│       ├── PHASE_00_FOUNDATION.md
│       ├── PHASE_01_LOCAL_DATABASE.md
│       ├── PHASE_02_WORKOUT_LOGGER.md
│       ├── PHASE_03_CARDIO_CORE.md
│       ├── PHASE_04_PROGRESSION.md
│       ├── PHASE_05_MEASUREMENTS_REPORTS.md
│       ├── PHASE_06_BACKEND.md
│       ├── PHASE_07_SYNC.md
│       └── PHASE_08_PWA_RELEASE.md
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── domain/
│   ├── validation/
│   └── shared-types/
└── .github/
    └── workflows/
        └── ci.yml
```

Adapt the monorepo layout if the team chooses a simpler repository, but
preserve the separation between frontend, backend, domain logic, and
shared validation/types.

------------------------------------------------------------------------

# 18. Master implementation prompt

Use this prompt with your coding assistant before starting development:

> You are a senior full-stack engineer and software architect. Build
> **Alok Fit Tracker**, an offline-first personal gym and fitness
> tracking PWA plus responsive website.
>
> Follow `README.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`,
> `docs/DATA_MODEL.md`, `docs/API_SPEC.md`, and the current phase
> specification as the source of truth.
>
> Non-negotiable requirements: 1. Mobile-first responsive React +
> TypeScript application. 2. Installable PWA with offline app-shell
> support. 3. IndexedDB (Dexie) local-first persistence. Workout entries
> must save locally immediately, even offline. 4. PostgreSQL-backed
> authenticated cloud API and safe automatic synchronization. 5. Stable
> UUIDs, idempotent sync, revision tracking, tombstones, and conflict
> detection. 6. Full workout logging: exercises, sets, reps, weights,
> set types, RPE/RIR, rest timer, notes, previous-session comparison. 7.
> Cardio logging: activity, duration, distance, speed, incline/decline,
> resistance, optional calories and heart rate. 8. Abs/core logging:
> reps, timed holds, weighted sets. 9. Explainable progression
> recommendations that the user confirms. 10. Body measurements, private
> progress photos, weekly/monthly reports, CSV export, and backup. 11.
> Strong validation, ownership checks, privacy, accessibility, and
> automated tests.
>
> Work only on the requested phase. First inspect the repository and
> existing implementation. Do not delete, simplify, or rewrite working
> features unless explicitly required. Preserve existing content and
> behavior. Before editing, provide a short implementation plan and list
> the files to be changed. Then implement the phase completely, run
> lint/type-check/tests/build, fix failures, and update documentation.
>
> Never hardcode credentials or secrets. Never claim a feature is
> complete unless it is implemented and tested. If a requirement depends
> on external credentials or services, implement a safe configuration
> path and clearly document the remaining manual setup. At the end,
> report files changed, features delivered, tests run and passed, known
> limitations, and exact next steps.

------------------------------------------------------------------------

# 19. Phase-by-phase GitHub implementation prompts

Copy the relevant prompt into your coding assistant when starting each
phase. Complete phases in order.

## Phase 0 prompt --- Foundation

> Implement Phase 0 for Alok Fit Tracker. Inspect the repository first.
> Set up a React + TypeScript + Vite frontend, Tailwind styling,
> routing, linting, formatting, environment validation, and CI. Create a
> mobile-first app shell with responsive sidebar/bottom navigation and
> placeholder routes for all modules. Add architecture documentation and
> environment examples. Do not build fake workout data or claim backend
> functionality. Add tests for the app shell and route rendering. Run
> lint, type-check, tests, and production build. Update README with
> exact setup commands.

## Phase 1 prompt --- Exercise library and local data

> Implement Phase 1. Add Dexie IndexedDB with versioned schema
> migrations and repository/service abstractions. Create
> profile/settings, exercise library, custom exercise CRUD, workout
> template CRUD, and an editable Monday-Friday starter plan. Seed common
> exercises safely without duplicating them on repeated app launches.
> All create/edit/delete actions must work offline and persist after
> refresh/restart. Add unit and database tests, migration tests, empty
> states, validation, and documentation. Do not add cloud sync yet.

## Phase 2 prompt --- Workout logger

> Implement Phase 2. Build the full workout lifecycle: start, resume,
> complete, abandon, edit history. Add exercise selection, current and
> previous-session comparison, multiple sets, warm-up/working/drop/timed
> set types, kg/lb display conversion, reps, duration, RPE/RIR, notes,
> and rest timer. Persist every change locally immediately. Support
> bodyweight and assisted movements without misleading volume
> calculations. Add a workout history view and filters. Test offline
> logging, app restart recovery, set calculations, and timer behavior.
> Do not remove any Phase 1 feature.

## Phase 3 prompt --- Cardio and abs/core

> Implement Phase 3. Add cardio logging for treadmill running/walking,
> incline walking, decline walking where supported, outdoor
> walking/running, cycling, stair climber, elliptical, rowing, and
> custom activities. Capture duration, distance, speed, incline, machine
> level, resistance, optional calories/source and heart rate. Add
> abs/core exercise modes for reps, timed holds, and weighted sets.
> Implement history, filters, weekly totals, and correct pace/speed
> calculations. Missing values must remain null rather than zero. Ensure
> all entries work offline and add tests.

## Phase 4 prompt --- Progression and PRs

> Implement Phase 4 as a pure, deterministic domain module. Add
> per-exercise target sets, rep range, increment, progression method,
> and optional effort ceiling. Implement double progression with clear
> maintain/increase/review/insufficient-data outcomes. Only suggest
> increasing load when all prescribed working sets reach the top of the
> rep range and no pain/poor-form flag or effort-limit violation exists.
> Use small configurable increments. Add user accept/dismiss/override.
> Add PR detection and optional clearly labelled estimated 1RM for
> appropriate rep ranges. Version the algorithm and unit-test edge
> cases. Never auto-change the user's plan or weights.

## Phase 5 prompt --- Measurements, photos, reports

> Implement Phase 5. Add dated body weight and configurable body
> measurements with units, notes, trends, and date filters. Add progress
> photo categories (front/side/back/custom), private upload workflow
> interfaces, metadata, deletion, and privacy notices. Add weekly and
> monthly reports with sessions, consistency, sets, reps, weighted
> volume, cardio, core, PRs, measurements, and exercise trends. Respect
> the user's timezone. Distinguish missing data from zero. Add CSV
> export with date-range filtering. Do not expose photos publicly or
> generate health/body-fat diagnoses. If cloud photo storage is not
> available yet, build a clearly labelled local development adapter and
> document the production dependency.

## Phase 6 prompt --- Backend and authentication

> Implement Phase 6. Build the TypeScript API, PostgreSQL schema, Prisma
> migrations, authentication, profile endpoints, and CRUD endpoints for
> exercises, templates, workouts, cardio, measurements, and photo
> metadata. Validate all request/response schemas. Enforce record
> ownership using the authenticated identity, not a client-supplied user
> ID. Add secure environment configuration, CORS restrictions, rate
> limits for sensitive routes, structured logs, and API tests. Keep the
> frontend local-first and fully usable if the API is offline. Document
> local database setup and deployment environment variables without
> including real secrets.

## Phase 7 prompt --- Offline/cloud sync

> Implement Phase 7. Build a robust sync protocol with local pending
> queue, push/pull endpoints, cursors, stable UUIDs, idempotency, server
> revisions, tombstones, partial batch results, retry with exponential
> backoff, and conflict detection. Preserve local data on every network
> or server failure. Add sync status per record and global pending
> count, manual Sync Now, launch/focus/online retry, and conflict
> resolution UI. Do not rely exclusively on Background Sync. Add tests
> for duplicate batches, offline-to-online recovery, two-device edits,
> deletions, expired authentication, partial failures, and restart
> recovery. Document sync protocol and limitations.

## Phase 8 prompt --- PWA, deployment, release

> Implement Phase 8. Configure the PWA manifest, icons, service worker,
> app-shell caching, offline navigation, and update strategy. Verify
> that core workout logging works offline after the first successful
> load. Configure production deployment for frontend, API, PostgreSQL,
> and private object storage using environment variables. Add health
> checks, monitoring, database backup/restore instructions, privacy
> policy template, data export/deletion, security review, and release
> checklist. Test Android Chrome and desktop browsers. Do not claim
> background sync is guaranteed on every browser. Provide exact
> deployment and rollback instructions.

------------------------------------------------------------------------

# 20. Definition of done

A phase is complete only when: - All phase requirements are
implemented. - Existing working functionality remains intact. -
Type-check, lint, tests, and production build pass. - No secrets or
personal data are committed. - Mobile and desktop layouts are checked. -
Offline behavior is tested where relevant. - Documentation and
screenshots are updated where useful. - Known limitations are explicitly
documented. - The GitHub commit message clearly identifies the phase.

## Final release checklist

-   [ ] User can install the PWA after first online visit.
-   [ ] User can log a full workout offline.
-   [ ] User can record cardio and abs/core offline.
-   [ ] Active workout survives refresh and app restart.
-   [ ] Previous workout values are shown correctly.
-   [ ] Progression suggestions are explainable and user-controlled.
-   [ ] Weekly/monthly reports use correct timezone boundaries.
-   [ ] Measurements and progress photos are private.
-   [ ] Offline records sync after reconnect.
-   [ ] Repeated sync does not create duplicates.
-   [ ] Multi-device conflicts are not silently overwritten.
-   [ ] CSV export works.
-   [ ] Backup and restore have been tested.
-   [ ] Account data can be deleted.
-   [ ] Android and desktop smoke tests pass.

------------------------------------------------------------------------

# 21. Recommended first release scope

To avoid building everything at once, prioritize:

**Release 1:** Phases 0--2 --- installable-looking responsive app
foundation, exercise library, templates, offline workout logger,
history.

**Release 2:** Phases 3--4 --- cardio, abs/core, progression engine,
personal records.

**Release 3:** Phases 5--7 --- measurements, photos, reports, backend,
authentication, cloud sync.

**Release 4:** Phase 8 --- production PWA, deployment, security
hardening, backup/restore.

The most important engineering principle is reliability: a workout entry
must never disappear because the gym's internet connection is weak. Save
locally first, sync later, and make the sync state visible to the user.


---

# 22. Workout session stopwatch — start, run in background, log sets, and finish

This is a mandatory feature of the Workout Logger. The user must be able to start a workout timer, enter workout data while the timer continues, temporarily leave the workout screen, and finish the session manually.

## Required user experience

### Start workout
- Show a prominent **Start Workout** button on the planned workout and workout logger screens.
- When tapped, create a workout session immediately and save `started_at` to IndexedDB.
- Show a live elapsed-time display, for example `00:32:18`.
- Start the timer from the persisted start timestamp, not from an in-memory counter alone.

### Timer continues while the user logs data
- The user can add exercises, enter weights, reps, sets, cardio, abs/core, notes, and rest periods while the workout stopwatch continues.
- Saving a set must not reset, pause, or stop the workout stopwatch.
- The user can navigate to another app section and return to the active workout without losing the session.
- The user can lock the phone, switch apps, or temporarily close/reopen the browser/PWA; when they return, the elapsed time must be recalculated from the saved timestamps.
- Do not depend on a JavaScript `setInterval` continuing in the background. Browsers throttle or suspend background tabs. Use `started_at`, accumulated paused duration, and current pause state to calculate elapsed time whenever the screen renders or becomes active again.
- The timer display may refresh while the app is visible, but the underlying elapsed-time calculation must remain correct even if refresh callbacks were suspended.

### Pause and resume
- Provide an optional **Pause Workout** action for breaks when the user wants excluded time not to count.
- On pause, persist `paused_at` and mark the session as paused.
- On resume, add the paused interval to `total_paused_seconds`, clear `paused_at`, and continue elapsed-time calculation.
- If the user does not pause, the stopwatch continues to include the entire time between start and finish, including rest between exercises.
- Make the counting rule visible: elapsed workout time excludes explicitly paused periods but includes normal rest periods.

### Finish workout
- Show a prominent **Finish Workout** button.
- On confirmation, save `completed_at`, calculate and persist the final duration, mark the session completed, and stop the active workout timer.
- Show a workout summary: total duration, exercises, completed sets, reps, training volume where valid, cardio, and abs/core entries.
- Allow the user to edit the completed workout later without changing its original start/end timestamps unless the user explicitly edits those timestamps.
- If the user accidentally leaves the workout active for many hours or overnight, do not silently finish it. On next launch, show the active session and ask whether to resume, finish it, or discard it. Keep the local record safe until the user chooses.

## Duration calculation

Persist:
- `started_at` — required timestamp.
- `paused_at` — nullable timestamp.
- `total_paused_seconds` — accumulated explicitly paused time.
- `completed_at` — nullable timestamp.
- `duration_seconds` — final calculated duration when completed.
- `status` — `in_progress`, `paused`, `completed`, or `abandoned`.

For an active, unpaused session:

`elapsed_seconds = now - started_at - total_paused_seconds`

For an active, paused session:

`elapsed_seconds = paused_at - started_at - total_paused_seconds`

For a completed session:

`duration_seconds = completed_at - started_at - total_paused_seconds`

Use UTC timestamps for storage and the user's local timezone for display. Guard against negative values and malformed timestamps. Handle device clock changes as safely as practical and document that timestamp-based elapsed time can be affected by manual system-clock changes.

## Data model additions

Add to `WorkoutSession`:
- `paused_at` (nullable timestamp)
- `total_paused_seconds` (integer, default 0)
- `duration_seconds` (nullable integer)
- `last_resumed_at` (nullable timestamp, optional for audit/debugging)

The session status enum must include `in_progress`, `paused`, `completed`, and `abandoned`.

## Acceptance tests

1. Start a workout and confirm the timer begins.
2. Add several sets while the timer runs; confirm set entry does not reset the timer.
3. Navigate to Dashboard and return; confirm the timer continues accurately.
4. Background the PWA or lock the phone for several minutes; return and confirm elapsed time reflects the full interval.
5. Close and reopen the app; confirm the active workout is restored with the correct elapsed time.
6. Pause for two minutes and resume; confirm the paused interval is excluded from workout duration.
7. Leave the workout unpaused during a normal rest period; confirm rest time is included.
8. Finish the workout; confirm the final duration is persisted and the timer no longer advances.
9. Reopen a completed workout; confirm its original duration remains unchanged.
10. Test offline; start, log, pause/resume, and finish a workout without network access.

## Phase prompt additions

**Add to Phase 2 — Workout logger prompt:**

> Implement a persistent workout stopwatch. Start Workout must save `started_at` locally immediately. The elapsed timer must continue logically while the user records sets, navigates around the app, switches apps, locks the phone, or closes/reopens the PWA. Do not rely on a background JavaScript interval; derive elapsed time from persisted timestamps and accumulated paused duration. Add Pause/Resume and Finish Workout actions. Normal rest time counts unless the user explicitly pauses the whole workout. On finish, persist `completed_at` and final duration and show a session summary. Restore an unfinished session after app restart and ask the user whether to resume, finish, or discard it. Add the acceptance tests in Section 22.

**Add to Phase 7 — Sync prompt:**

> Ensure workout start, pause, resume, finish, and duration metadata synchronize safely across devices. Use revisions and conflict detection. Never let a stale device silently overwrite a newer active/completed session. Preserve the original start/end timestamps and final duration when syncing completed sessions.

