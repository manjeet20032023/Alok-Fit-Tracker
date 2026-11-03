import type { PersonalRecord, WorkoutSet } from '../data/db'

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

export interface ProgressionInput {
  prescribedWorkingSets: number
  completedWorkingSets: number
  maxReps: number
  actualReps: number[]
  painOrPoorForm: boolean
  incrementKg: number
}

export function getProgressionSuggestion(input: ProgressionInput): { action: 'increase' | 'maintain' | 'insufficient'; reason: string } {
  if (input.painOrPoorForm) return { action: 'maintain', reason: 'Maintain the load because pain or poor form was reported.' }
  if (input.completedWorkingSets !== input.prescribedWorkingSets || input.actualReps.length !== input.prescribedWorkingSets) return { action: 'insufficient', reason: 'Complete all prescribed working sets before considering progression.' }
  if (input.actualReps.every((reps) => reps >= input.maxReps) && input.incrementKg > 0) return { action: 'increase', reason: `Consider the user-confirmed increment of ${input.incrementKg} kg next session.` }
  return { action: 'maintain', reason: 'Maintain the same load until all prescribed sets reach the top of the rep range.' }
}
