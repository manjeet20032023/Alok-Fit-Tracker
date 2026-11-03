import { db, type SyncOutboxItem, type Workout } from './db'
import { supabase } from './supabase'

export interface SyncResult {
  status: 'synced' | 'offline' | 'unconfigured' | 'error' | 'unauthenticated' | 'conflict'
  synced: number
}

export async function enqueue(entityType: string, entityId: string, payload: unknown, revision = 1, operation: 'upsert' | 'delete' = 'upsert') {
  const now = new Date().toISOString()
  const item: SyncOutboxItem = {
    id: crypto.randomUUID(), entityType, entityId, operation, payload: JSON.stringify(payload), revision,
    attempts: 0, status: 'pending', createdAt: now, updatedAt: now,
  }
  await db.syncOutbox.add(item)
}

function shouldApplyRemote(pending: SyncOutboxItem[], entityType: string, entityId: string, remoteUpdatedAt: string, localUpdatedAt?: string) {
  if (pending.some((item) => item.entityType === entityType && item.entityId === entityId)) return false
  if (!localUpdatedAt) return true
  const remoteTime = Date.parse(remoteUpdatedAt)
  const localTime = Date.parse(localUpdatedAt)
  return Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime > localTime)
}

export function shouldApplyRemoteTombstone(pending: SyncOutboxItem[], entityType: string, entityId: string) {
  return !pending.some((item) => item.entityType === entityType && item.entityId === entityId)
}

async function pullRemoteData(userId: string) {
  if (!supabase) return
  const pending = await db.syncOutbox.toArray()

  const profileResult = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle()
  if (profileResult.error) throw profileResult.error
  if (profileResult.data) {
    const remote = profileResult.data
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'profiles', 'default')) await db.profiles.delete('default')
    } else {
    const local = await db.profiles.get('default')
    if (shouldApplyRemote(pending, 'profiles', 'default', remote.updated_at, local?.updatedAt)) {
      await db.profiles.put({
        id: 'default', heightCm: Number(remote.height_cm), weightKg: Number(remote.weight_kg), goal: remote.goal,
        weightUnit: remote.weight_unit, distanceUnit: remote.distance_unit, targetMinutes: remote.target_minutes,
        theme: remote.theme, revision: remote.revision, updatedAt: remote.updated_at,
      })
    }
    }
  }

  const workoutResult = await supabase.from('workouts').select('*').eq('user_id', userId)
  if (workoutResult.error) throw workoutResult.error
  for (const remote of workoutResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'workouts', remote.id)) await db.workouts.delete(remote.id)
      continue
    }
    const local = await db.workouts.get(remote.id)
    if (!shouldApplyRemote(pending, 'workouts', remote.id, remote.updated_at, local?.updatedAt)) continue
    const workout: Workout = {
      id: remote.id, localDate: remote.local_date, timezone: remote.timezone, plannedFocus: remote.planned_focus, location: remote.location ?? null,
      status: remote.status, startedAt: remote.started_at, pausedAt: remote.paused_at, lastResumedAt: remote.last_resumed_at,
      totalPausedSeconds: remote.total_paused_seconds, completedAt: remote.completed_at, durationSeconds: remote.duration_seconds,
      notes: remote.notes, revision: remote.revision, createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    }
    await db.workouts.put(workout)
  }

  const exerciseResult = await supabase.from('exercises').select('*').eq('user_id', userId)
  if (exerciseResult.error) throw exerciseResult.error
  for (const remote of exerciseResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'exercises', remote.id)) await db.exercises.delete(remote.id)
      continue
    }
    const local = await db.exercises.get(remote.id)
    if (!shouldApplyRemote(pending, 'exercises', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.exercises.put({
      id: remote.id, catalogKey: remote.catalog_key ?? undefined, name: remote.name, muscleGroups: remote.muscle_groups, equipment: remote.equipment,
      exerciseType: remote.exercise_type, instructions: remote.instructions, isCustom: remote.is_custom,
      createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    })
  }

  const workoutExerciseResult = await supabase.from('workout_exercises').select('*').eq('user_id', userId)
  if (workoutExerciseResult.error) throw workoutExerciseResult.error
  for (const remote of workoutExerciseResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'workoutExercises', remote.id)) await db.workoutExercises.delete(remote.id)
      continue
    }
    const local = await db.workoutExercises.get(remote.id)
    if (!shouldApplyRemote(pending, 'workoutExercises', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.workoutExercises.put({
      id: remote.id, workoutId: remote.workout_id, name: remote.name, muscleGroup: remote.muscle_group,
      section: remote.section, order: remote.sort_order, revision: remote.revision, updatedAt: remote.updated_at,
    })
  }

  const workoutSetResult = await supabase.from('workout_sets').select('*').eq('user_id', userId)
  if (workoutSetResult.error) throw workoutSetResult.error
  for (const remote of workoutSetResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'workoutSets', remote.id)) await db.workoutSets.delete(remote.id)
      continue
    }
    const local = await db.workoutSets.get(remote.id)
    if (!shouldApplyRemote(pending, 'workoutSets', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.workoutSets.put({
      id: remote.id, workoutId: remote.workout_id, workoutExerciseId: remote.workout_exercise_id,
      setNumber: remote.set_number, reps: remote.reps, weightKg: remote.weight_kg, durationSeconds: remote.duration_seconds,
      completed: remote.completed, notes: remote.notes, revision: remote.revision, updatedAt: remote.updated_at,
    })
  }

  const cardioResult = await supabase.from('cardio_entries').select('*').eq('user_id', userId)
  if (cardioResult.error) throw cardioResult.error
  for (const remote of cardioResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'cardioEntries', remote.id)) await db.cardioEntries.delete(remote.id)
      continue
    }
    const local = await db.cardioEntries.get(remote.id)
    if (!shouldApplyRemote(pending, 'cardioEntries', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.cardioEntries.put({
      id: remote.id, workoutId: remote.workout_id, activityType: remote.activity_type, durationSeconds: remote.duration_seconds,
      distanceMeters: remote.distance_meters, speedKph: remote.speed_kph ?? null, inclinePercent: remote.incline_percent, heartRate: remote.heart_rate,
      calories: remote.calories, notes: remote.notes, revision: remote.revision, updatedAt: remote.updated_at,
    })
  }

  const measurementResult = await supabase.from('measurements').select('*').eq('user_id', userId)
  if (measurementResult.error) throw measurementResult.error
  for (const remote of measurementResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'measurements', remote.id)) await db.measurements.delete(remote.id)
      continue
    }
    const local = await db.measurements.get(remote.id)
    if (!shouldApplyRemote(pending, 'measurements', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.measurements.put({
      id: remote.id, type: remote.type, value: remote.value, unit: remote.unit, measuredAt: remote.measured_at,
      note: remote.note, createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    })
  }

  const goalResult = await supabase.from('goals').select('*').eq('user_id', userId)
  if (goalResult.error) throw goalResult.error
  for (const remote of goalResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'goals', remote.id)) await db.goals.delete(remote.id)
      continue
    }
    const local = await db.goals.get(remote.id)
    if (!shouldApplyRemote(pending, 'goals', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.goals.put({
      id: remote.id, name: remote.name, targetValue: remote.target_value, unit: remote.unit, startValue: remote.start_value,
      startDate: remote.start_date, targetDate: remote.target_date, status: remote.status,
      createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    })
  }

  const recordResult = await supabase.from('personal_records').select('*').eq('user_id', userId)
  if (recordResult.error) throw recordResult.error
  for (const remote of recordResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'personalRecords', remote.id)) await db.personalRecords.delete(remote.id)
      continue
    }
    const local = await db.personalRecords.get(remote.id)
    if (!shouldApplyRemote(pending, 'personalRecords', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.personalRecords.put({
      id: remote.id, exerciseName: remote.exercise_name, type: remote.type, value: remote.value, unit: remote.unit,
      workoutId: remote.workout_id, achievedAt: remote.achieved_at,
      createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    })
  }

  const photoResult = await supabase.from('progress_photos').select('*').eq('user_id', userId)
  if (photoResult.error) throw photoResult.error
  for (const remote of photoResult.data ?? []) {
    if (remote.deleted_at) {
      if (shouldApplyRemoteTombstone(pending, 'progressPhotos', remote.id)) await db.progressPhotos.delete(remote.id)
      continue
    }
    const local = await db.progressPhotos.get(remote.id)
    if (!shouldApplyRemote(pending, 'progressPhotos', remote.id, remote.updated_at, local?.updatedAt)) continue
    await db.progressPhotos.put({
      id: remote.id, category: remote.category, capturedAt: remote.captured_at, note: remote.note,
      blob: local?.blob ?? new Blob([], { type: remote.content_type }), contentType: remote.content_type,
      storageKey: remote.storage_key, fileSizeBytes: remote.file_size_bytes,
      createdAt: remote.created_at, updatedAt: remote.updated_at, deletedAt: remote.deleted_at,
    })
  }
}

export async function syncNow(): Promise<SyncResult> {
  if (!supabase || !navigator.onLine) return { status: !supabase ? 'unconfigured' : 'offline', synced: 0 }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) return { status: 'unauthenticated', synced: 0 }
  const userId = sessionData.session.user.id
  const pending = await db.syncOutbox.where('status').anyOf(['pending', 'failed', 'syncing']).sortBy('updatedAt')
  let synced = 0

  for (const item of pending) {
    try {
      await db.syncOutbox.update(item.id, { status: 'syncing', attempts: item.attempts + 1, updatedAt: new Date().toISOString() })
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      if (item.operation === 'delete') {
        const now = new Date().toISOString()
        if (item.entityType === 'progressPhotos') {
          const photo = payload as { storageKey?: string; contentType?: string }
          const extension = photo.contentType === 'image/png' ? 'png' : photo.contentType === 'image/webp' ? 'webp' : 'jpg'
          const storageKey = photo.storageKey ?? `${userId}/${item.entityId}.${extension}`
          if (storageKey) {
            const removed = await supabase.storage.from('progress-photos').remove([storageKey])
            if (removed.error) throw removed.error
          }
          const result = await supabase.from('progress_photos').update({ deleted_at: now, updated_at: now }).eq('id', item.entityId).eq('user_id', userId)
          if (result.error) throw result.error
        } else {
          const tableByEntity: Record<string, string> = {
            workouts: 'workouts', exercises: 'exercises', measurements: 'measurements', goals: 'goals',
            workoutExercises: 'workout_exercises', workoutSets: 'workout_sets', cardioEntries: 'cardio_entries', personalRecords: 'personal_records',
          }
          const tableName = tableByEntity[item.entityType]
          if (!tableName) throw new Error(`Unsupported delete entity: ${item.entityType}`)
          const result = await supabase.from(tableName).update({ deleted_at: now, updated_at: now }).eq('id', item.entityId).eq('user_id', userId)
          if (result.error) throw result.error
        }
      } else if (item.entityType === 'workouts') {
        const workout = payload as { localDate: string; timezone: string; plannedFocus: string[]; location?: string | null; status: string; startedAt: string; pausedAt: string | null; lastResumedAt: string | null; totalPausedSeconds: number; completedAt: string | null; durationSeconds: number | null; notes: string; revision: number; createdAt: string; updatedAt: string; deletedAt: string | null }
        const remote = await supabase.from('workouts').select('revision, updated_at').eq('id', item.entityId).maybeSingle()
        const alreadyApplied = remote.data && Number(remote.data.revision) === item.revision && Date.parse(remote.data.updated_at) === Date.parse(workout.updatedAt)
        if (remote.data && Number(remote.data.revision) >= item.revision && !alreadyApplied) {
          await db.syncOutbox.update(item.id, { status: 'conflict', updatedAt: new Date().toISOString() })
          continue
        }
        const result = await supabase.from('workouts').upsert({
          id: item.entityId, user_id: userId, local_date: workout.localDate, timezone: workout.timezone,
          planned_focus: workout.plannedFocus, ...(workout.location ? { location: workout.location } : {}), status: workout.status, started_at: workout.startedAt,
          paused_at: workout.pausedAt, last_resumed_at: workout.lastResumedAt,
          total_paused_seconds: workout.totalPausedSeconds, completed_at: workout.completedAt,
          duration_seconds: workout.durationSeconds, notes: workout.notes, revision: workout.revision,
          created_at: workout.createdAt, updated_at: workout.updatedAt, deleted_at: workout.deletedAt,
        })
        if (result.error) throw result.error
      } else if (item.entityType === 'cardioEntries') {
        const cardio = payload as { workoutId: string; activityType: string; durationSeconds: number; distanceMeters: number | null; speedKph?: number | null; inclinePercent: number | null; heartRate: number | null; calories: number | null; notes: string }
        const result = await supabase.from('cardio_entries').upsert({ id: item.entityId, user_id: userId, workout_id: cardio.workoutId, activity_type: cardio.activityType, duration_seconds: cardio.durationSeconds, distance_meters: cardio.distanceMeters, ...(cardio.speedKph !== undefined ? { speed_kph: cardio.speedKph } : {}), incline_percent: cardio.inclinePercent, heart_rate: cardio.heartRate, calories: cardio.calories, notes: cardio.notes, revision: item.revision, updated_at: new Date().toISOString() })
        if (result.error) throw result.error
      } else if (item.entityType === 'exercises') {
        const exercise = payload as { catalogKey?: string; name: string; muscleGroups: string[]; equipment: string; exerciseType: string; instructions: string; isCustom: boolean; createdAt: string; updatedAt: string; deletedAt: string | null }
        const result = await supabase.from('exercises').upsert({ id: item.entityId, user_id: userId, ...(exercise.catalogKey !== undefined ? { catalog_key: exercise.catalogKey } : {}), name: exercise.name, muscle_groups: exercise.muscleGroups, equipment: exercise.equipment, exercise_type: exercise.exerciseType, instructions: exercise.instructions, is_custom: exercise.isCustom, revision: item.revision, created_at: exercise.createdAt, updated_at: new Date().toISOString(), deleted_at: exercise.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'workoutExercises') {
        const exercise = payload as { workoutId: string; name: string; muscleGroup: string; section: 'weight'|'core'; order: number }
        const result = await supabase.from('workout_exercises').upsert({ id: item.entityId, user_id: userId, workout_id: exercise.workoutId, name: exercise.name, muscle_group: exercise.muscleGroup, section: exercise.section, sort_order: exercise.order, revision: item.revision, updated_at: new Date().toISOString() })
        if (result.error) throw result.error
      } else if (item.entityType === 'workoutSets') {
        const set = payload as { workoutId: string; workoutExerciseId: string; setNumber: number; reps: number|null; weightKg: number|null; durationSeconds: number|null; completed: boolean; notes: string }
        const result = await supabase.from('workout_sets').upsert({ id: item.entityId, user_id: userId, workout_id: set.workoutId, workout_exercise_id: set.workoutExerciseId, set_number: set.setNumber, reps: set.reps, weight_kg: set.weightKg, duration_seconds: set.durationSeconds, completed: set.completed, notes: set.notes, revision: item.revision, updated_at: new Date().toISOString() })
        if (result.error) throw result.error
      } else if (item.entityType === 'personalRecords') {
        const record = payload as { exerciseName: string; type: string; value: number; unit: string; workoutId: string|null; achievedAt: string; createdAt: string; updatedAt: string; deletedAt: string|null }
        const result = await supabase.from('personal_records').upsert({ id: item.entityId, user_id: userId, exercise_name: record.exerciseName, type: record.type, value: record.value, unit: record.unit, workout_id: record.workoutId, achieved_at: record.achievedAt, revision: item.revision, created_at: record.createdAt, updated_at: record.updatedAt, deleted_at: record.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'progressPhotos') {
        const photo = payload as { category: string; capturedAt: string; note: string; storageKey?: string | null; contentType: string; fileSizeBytes?: number; createdAt: string; updatedAt: string; deletedAt: string|null }
        let storageKey = photo.storageKey
        let fileSizeBytes = photo.fileSizeBytes
        if (!storageKey) {
          const localPhoto = await db.progressPhotos.get(item.entityId)
          if (!localPhoto?.blob) throw new Error('Photo data is unavailable for cloud upload')
          const extension = photo.contentType === 'image/png' ? 'png' : photo.contentType === 'image/webp' ? 'webp' : 'jpg'
          storageKey = `${userId}/${item.entityId}.${extension}`
          const upload = await supabase.storage.from('progress-photos').upload(storageKey, localPhoto.blob, { contentType: photo.contentType, upsert: true })
          if (upload.error) throw upload.error
          fileSizeBytes = localPhoto.blob.size
          await db.progressPhotos.update(item.entityId, { storageKey, fileSizeBytes, updatedAt: new Date().toISOString() })
        }
        const result = await supabase.from('progress_photos').upsert({ id: item.entityId, user_id: userId, category: photo.category, captured_at: photo.capturedAt, note: photo.note, storage_key: storageKey, content_type: photo.contentType, file_size_bytes: fileSizeBytes, revision: item.revision, created_at: photo.createdAt, updated_at: photo.updatedAt, deleted_at: photo.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'measurements') {
        const measurement = payload as { type: string; value: number; unit: string; measuredAt: string; note: string; createdAt: string; updatedAt: string; deletedAt: string | null }
        const result = await supabase.from('measurements').upsert({ id: item.entityId, user_id: userId, type: measurement.type, value: measurement.value, unit: measurement.unit, measured_at: measurement.measuredAt, note: measurement.note, revision: item.revision, created_at: measurement.createdAt, updated_at: measurement.updatedAt, deleted_at: measurement.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'goals') {
        const goal = payload as { name: string; targetValue: number; unit: string; startValue: number; startDate: string; targetDate: string | null; status: string; createdAt: string; updatedAt: string; deletedAt: string | null }
        const result = await supabase.from('goals').upsert({ id: item.entityId, user_id: userId, name: goal.name, target_value: goal.targetValue, unit: goal.unit, start_value: goal.startValue, start_date: goal.startDate, target_date: goal.targetDate, status: goal.status, revision: item.revision, created_at: goal.createdAt, updated_at: goal.updatedAt, deleted_at: goal.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'profiles') {
        const profile = payload as { id: string; heightCm: number; weightKg: number; goal: string; weightUnit: string; distanceUnit: string; targetMinutes: number; theme: string }
        const result = await supabase.from('profiles').upsert({ user_id: userId, height_cm: profile.heightCm, weight_kg: profile.weightKg, goal: profile.goal, weight_unit: profile.weightUnit, distance_unit: profile.distanceUnit, target_minutes: profile.targetMinutes, theme: profile.theme, revision: item.revision, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        if (result.error) throw result.error
      }
      await db.syncOutbox.delete(item.id)
      synced += 1
    } catch {
      await db.syncOutbox.update(item.id, { status: 'failed', updatedAt: new Date().toISOString() })
    }
  }
  let pullFailed = false
  try {
    await pullRemoteData(userId)
  } catch {
    pullFailed = true
  }
  const conflicts = await db.syncOutbox.where('status').equals('conflict').count()
  const failures = await db.syncOutbox.where('status').equals('failed').count()
  return conflicts ? { status: 'conflict', synced } : failures || pullFailed ? { status: 'error', synced } : { status: 'synced', synced }
}

export async function resolveWorkoutConflict(itemId: string, choice: 'keep-local' | 'use-cloud'): Promise<boolean> {
  if (!supabase) return false
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) return false
  const item = await db.syncOutbox.get(itemId)
  if (!item || item.entityType !== 'workouts' || item.status !== 'conflict') return false
  const userId = sessionData.session.user.id
  const { data: remote, error } = await supabase.from('workouts').select('*').eq('id', item.entityId).eq('user_id', userId).maybeSingle()
  if (error) throw error

  if (choice === 'use-cloud') {
    if (!remote) return false
    const workout: Workout = {
      id: remote.id,
      localDate: remote.local_date,
      timezone: remote.timezone,
      plannedFocus: remote.planned_focus,
      location: remote.location ?? null,
      status: remote.status,
      startedAt: remote.started_at,
      pausedAt: remote.paused_at,
      lastResumedAt: remote.last_resumed_at,
      totalPausedSeconds: remote.total_paused_seconds,
      completedAt: remote.completed_at,
      durationSeconds: remote.duration_seconds,
      notes: remote.notes,
      revision: remote.revision,
      createdAt: remote.created_at,
      updatedAt: remote.updated_at,
      deletedAt: remote.deleted_at,
    }
    await db.transaction('rw', [db.workouts, db.syncOutbox], async () => {
      await db.workouts.put(workout)
      await db.syncOutbox.delete(item.id)
    })
    return true
  }

  const payload = JSON.parse(item.payload) as Record<string, unknown>
  const revision = Math.max(Number(remote?.revision) || 0, Number(payload.revision) || item.revision) + 1
  const updatedAt = new Date().toISOString()
  payload.revision = revision
  payload.updatedAt = updatedAt
  await db.transaction('rw', [db.workouts, db.syncOutbox], async () => {
    await db.workouts.update(item.entityId, { revision, updatedAt })
    await db.syncOutbox.update(item.id, { revision, payload: JSON.stringify(payload), status: 'pending', updatedAt })
  })
  return true
}
