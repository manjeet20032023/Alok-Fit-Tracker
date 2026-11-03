import type { PersonalRecord, Workout, WorkoutExercise, WorkoutSet } from '../data/db'

export interface StrengthLog {
  exerciseId: string
  exerciseName: string
  workoutId: string
  achievedAt: string
  sets: WorkoutSet[]
}

export function estimated1Rm(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 10) return null
  return weightKg * (1 + reps / 30)
}

export function derivePersonalRecords(logs: StrengthLog[]): PersonalRecord[] {
  const records: PersonalRecord[] = []
  for (const log of logs) {
    const completed = log.sets.filter((set) => set.completed && set.weightKg != null && set.reps != null)
    if (!completed.length) continue

    let bestWeight: WorkoutSet | null = null
    let bestRepsAtWeight: WorkoutSet | null = null
    let bestEstimate: { set: WorkoutSet; value: number } | null = null
    for (const set of completed) {
      if (!bestWeight || (set.weightKg ?? 0) > (bestWeight.weightKg ?? 0)) bestWeight = set
      if (!bestRepsAtWeight || ((set.reps ?? 0) > (bestRepsAtWeight.reps ?? 0) && (set.weightKg ?? 0) >= (bestRepsAtWeight.weightKg ?? 0))) bestRepsAtWeight = set
      const estimate = estimated1Rm(set.weightKg ?? 0, set.reps ?? 0)
      if (estimate != null && (!bestEstimate || estimate > bestEstimate.value)) bestEstimate = { set, value: estimate }
    }
    const now = log.achievedAt
    if (bestWeight?.weightKg != null) records.push({ id: crypto.randomUUID(), exerciseName: log.exerciseName, type: 'weight', value: bestWeight.weightKg, unit: 'kg', workoutId: log.workoutId, achievedAt: now, createdAt: now, updatedAt: now, deletedAt: null })
    if (bestRepsAtWeight?.reps != null && bestRepsAtWeight.weightKg != null) records.push({ id: crypto.randomUUID(), exerciseName: log.exerciseName, type: 'reps_at_weight', value: bestRepsAtWeight.reps, unit: `${bestRepsAtWeight.weightKg} kg`, workoutId: log.workoutId, achievedAt: now, createdAt: now, updatedAt: now, deletedAt: null })
    if (bestEstimate) records.push({ id: crypto.randomUUID(), exerciseName: log.exerciseName, type: 'estimated_1rm', value: Number(bestEstimate.value.toFixed(2)), unit: 'kg estimate', workoutId: log.workoutId, achievedAt: now, createdAt: now, updatedAt: now, deletedAt: null })
  }
  return records
}

export function getCurrentPersonalRecords(records: PersonalRecord[]): PersonalRecord[] {
  const bestByMetric = new Map<string, PersonalRecord>()
  for (const record of records) {
    if (record.deletedAt) continue
    const metric = record.type === 'reps_at_weight' ? record.unit : record.type
    const key = `${record.exerciseName.trim().toLocaleLowerCase()}|${metric}`
    const current = bestByMetric.get(key)
    if (!current || record.value > current.value || (record.value === current.value && record.achievedAt > current.achievedAt)) {
      bestByMetric.set(key, record)
    }
  }
  return [...bestByMetric.values()].sort((left, right) => right.achievedAt.localeCompare(left.achievedAt))
}

export interface ProgressionInput {
  prescribedWorkingSets: number
  completedWorkingSets: number
  maxReps: number
  actualReps: number[]
  painOrPoorForm: boolean
  incrementKg: number
}

export interface RecentStrengthLog {
  exerciseName: string
  workoutId: string
  performedAt: string
  prescribedWorkingSets: number
  completedWorkingSets: number
  actualReps: number[]
}

export function getRecentStrengthLogs(workouts: Workout[], exercises: WorkoutExercise[], sets: WorkoutSet[]): RecentStrengthLog[] {
  const completedWorkouts = workouts
    .filter((workout) => workout.status === 'completed' && !workout.deletedAt)
    .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))
  const latestByExercise = new Set<string>()
  const logs: RecentStrengthLog[] = []

  for (const workout of completedWorkouts) {
    for (const exercise of exercises.filter((item) => item.workoutId === workout.id && item.section === 'weight')) {
      const key = exercise.name.trim().toLocaleLowerCase()
      if (!key || latestByExercise.has(key)) continue
      const workingSets = sets.filter((set) => set.workoutExerciseId === exercise.id && set.weightKg != null)
      if (!workingSets.length) continue
      const completedSets = workingSets.filter((set) => set.completed && set.reps != null)
      latestByExercise.add(key)
      logs.push({
        exerciseName: exercise.name,
        workoutId: workout.id,
        performedAt: workout.completedAt ?? workout.localDate,
        prescribedWorkingSets: workingSets.length,
        completedWorkingSets: completedSets.length,
        actualReps: completedSets.map((set) => set.reps as number),
      })
    }
  }
  return logs
}

export function getProgressionSuggestion(input: ProgressionInput): { action: 'increase' | 'maintain' | 'insufficient'; reason: string } {
  if (input.painOrPoorForm) return { action: 'maintain', reason: 'Maintain the load because pain or poor form was reported.' }
  if (input.completedWorkingSets !== input.prescribedWorkingSets || input.actualReps.length !== input.prescribedWorkingSets) return { action: 'insufficient', reason: 'Complete all prescribed working sets before considering progression.' }
  if (input.actualReps.every((reps) => reps >= input.maxReps) && input.incrementKg > 0) return { action: 'increase', reason: `Consider the user-confirmed increment of ${input.incrementKg} kg next session.` }
  return { action: 'maintain', reason: 'Maintain the same load until all prescribed sets reach the top of the rep range.' }
}
