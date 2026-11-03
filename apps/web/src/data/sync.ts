import { db, type SyncOutboxItem } from './db'
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

export async function syncNow(): Promise<SyncResult> {
  if (!supabase || !navigator.onLine) return { status: !supabase ? 'unconfigured' : 'offline', synced: 0 }
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session) return { status: 'unauthenticated', synced: 0 }
  const userId = sessionData.session.user.id
  const pending = await db.syncOutbox.where('status').anyOf(['pending', 'failed']).sortBy('updatedAt')
  let synced = 0

  for (const item of pending) {
    try {
      await db.syncOutbox.update(item.id, { status: 'syncing', attempts: item.attempts + 1, updatedAt: new Date().toISOString() })
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      if (item.operation === 'delete') {
        const tableName = item.entityType as 'workouts' | 'exercises' | 'measurements' | 'goals'
        const result = await supabase.from(tableName).update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.entityId).eq('user_id', userId)
        if (result.error) throw result.error
      } else if (item.entityType === 'workouts') {
        const workout = payload as { localDate: string; timezone: string; plannedFocus: string[]; status: string; startedAt: string; pausedAt: string | null; lastResumedAt: string | null; totalPausedSeconds: number; completedAt: string | null; durationSeconds: number | null; notes: string; revision: number; createdAt: string; updatedAt: string; deletedAt: string | null }
        const remote = await supabase.from('workouts').select('revision').eq('id', item.entityId).maybeSingle()
        if (remote.data && Number(remote.data.revision) > item.revision) {
          await db.syncOutbox.update(item.id, { status: 'conflict', updatedAt: new Date().toISOString() })
          continue
        }
        const result = await supabase.from('workouts').upsert({
          id: item.entityId, user_id: userId, local_date: workout.localDate, timezone: workout.timezone,
          planned_focus: workout.plannedFocus, status: workout.status, started_at: workout.startedAt,
          paused_at: workout.pausedAt, last_resumed_at: workout.lastResumedAt,
          total_paused_seconds: workout.totalPausedSeconds, completed_at: workout.completedAt,
          duration_seconds: workout.durationSeconds, notes: workout.notes, revision: workout.revision,
          created_at: workout.createdAt, updated_at: workout.updatedAt, deleted_at: workout.deletedAt,
        })
        if (result.error) throw result.error
      } else if (item.entityType === 'cardioEntries') {
        const cardio = payload as { workoutId: string; activityType: string; durationSeconds: number; distanceMeters: number | null; inclinePercent: number | null; heartRate: number | null; calories: number | null; notes: string }
        const result = await supabase.from('cardio_entries').upsert({ id: item.entityId, user_id: userId, workout_id: cardio.workoutId, activity_type: cardio.activityType, duration_seconds: cardio.durationSeconds, distance_meters: cardio.distanceMeters, incline_percent: cardio.inclinePercent, heart_rate: cardio.heartRate, calories: cardio.calories, notes: cardio.notes, revision: item.revision })
        if (result.error) throw result.error
      } else if (item.entityType === 'exercises') {
        const exercise = payload as { name: string; muscleGroups: string[]; equipment: string; exerciseType: string; instructions: string; isCustom: boolean; createdAt: string; updatedAt: string; deletedAt: string | null }
        const result = await supabase.from('exercises').upsert({ id: item.entityId, user_id: userId, name: exercise.name, muscle_groups: exercise.muscleGroups, equipment: exercise.equipment, exercise_type: exercise.exerciseType, instructions: exercise.instructions, is_custom: exercise.isCustom, revision: item.revision, created_at: exercise.createdAt, updated_at: exercise.updatedAt, deleted_at: exercise.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'workoutExercises') {
        const exercise = payload as { workoutId: string; name: string; muscleGroup: string; section: 'weight'|'core'; order: number }
        const result = await supabase.from('workout_exercises').upsert({ id: item.entityId, user_id: userId, workout_id: exercise.workoutId, name: exercise.name, muscle_group: exercise.muscleGroup, section: exercise.section, sort_order: exercise.order, revision: item.revision })
        if (result.error) throw result.error
      } else if (item.entityType === 'workoutSets') {
        const set = payload as { workoutId: string; workoutExerciseId: string; setNumber: number; reps: number|null; weightKg: number|null; durationSeconds: number|null; completed: boolean; notes: string }
        const result = await supabase.from('workout_sets').upsert({ id: item.entityId, user_id: userId, workout_id: set.workoutId, workout_exercise_id: set.workoutExerciseId, set_number: set.setNumber, reps: set.reps, weight_kg: set.weightKg, duration_seconds: set.durationSeconds, completed: set.completed, notes: set.notes, revision: item.revision })
        if (result.error) throw result.error
      } else if (item.entityType === 'personalRecords') {
        const record = payload as { exerciseName: string; type: string; value: number; unit: string; workoutId: string|null; achievedAt: string; createdAt: string; updatedAt: string; deletedAt: string|null }
        const result = await supabase.from('personal_records').upsert({ id: item.entityId, user_id: userId, exercise_name: record.exerciseName, type: record.type, value: record.value, unit: record.unit, workout_id: record.workoutId, achieved_at: record.achievedAt, revision: item.revision, created_at: record.createdAt, updated_at: record.updatedAt, deleted_at: record.deletedAt })
        if (result.error) throw result.error
      } else if (item.entityType === 'progressPhotos') {
        const photo = payload as { category: string; capturedAt: string; note: string; storageKey: string; contentType: string; fileSizeBytes: number; createdAt: string; updatedAt: string; deletedAt: string|null }
        const result = await supabase.from('progress_photos').upsert({ id: item.entityId, user_id: userId, category: photo.category, captured_at: photo.capturedAt, note: photo.note, storage_key: photo.storageKey, content_type: photo.contentType, file_size_bytes: photo.fileSizeBytes, revision: item.revision, created_at: photo.createdAt, updated_at: photo.updatedAt, deleted_at: photo.deletedAt })
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
        const result = await supabase.from('profiles').upsert({ user_id: userId, height_cm: profile.heightCm, weight_kg: profile.weightKg, goal: profile.goal, weight_unit: profile.weightUnit, distance_unit: profile.distanceUnit, target_minutes: profile.targetMinutes, theme: profile.theme }, { onConflict: 'user_id' })
        if (result.error) throw result.error
      }
      await db.syncOutbox.delete(item.id)
      synced += 1
    } catch {
      await db.syncOutbox.update(item.id, { status: 'failed', updatedAt: new Date().toISOString() })
    }
  }
  const conflicts = await db.syncOutbox.where('status').equals('conflict').count()
  return conflicts ? { status: 'conflict', synced } : { status: 'synced', synced }
}
