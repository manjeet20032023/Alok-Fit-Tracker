import { z } from 'zod'
import { db } from './db'

const snapshotSchema = z.object({
  exportedAt: z.string(),
  profiles: z.array(z.record(z.string(), z.unknown())).default([]),
  workouts: z.array(z.record(z.string(), z.unknown())).default([]),
  workoutExercises: z.array(z.record(z.string(), z.unknown())).default([]),
  workoutSets: z.array(z.record(z.string(), z.unknown())).default([]),
  cardioEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  exercises: z.array(z.record(z.string(), z.unknown())).default([]),
  measurements: z.array(z.record(z.string(), z.unknown())).default([]),
  goals: z.array(z.record(z.string(), z.unknown())).default([]),
})

export function validateBackup(text: string) {
  try {
    return snapshotSchema.safeParse(JSON.parse(text))
  } catch {
    throw new SyntaxError('The selected file is not valid JSON.')
  }
}

export async function restoreBackup(text: string) {
  let parsed
  try {
    parsed = validateBackup(text)
  } catch (error) {
    return { restored: false, reason: error instanceof Error ? error.message : 'Invalid JSON backup' }
  }
  if (!parsed.success) return { restored: false, reason: parsed.error.issues.map((issue) => issue.message).join('; ') }
  const data = parsed.data
  await db.transaction('rw', db.profiles, db.workouts, db.workoutExercises, db.workoutSets, db.cardioEntries, db.exercises, db.measurements, db.goals, async () => {
    await db.profiles.bulkPut(data.profiles as never[])
    await db.workouts.bulkPut(data.workouts as never[])
    await db.workoutExercises.bulkPut(data.workoutExercises as never[])
    await db.workoutSets.bulkPut(data.workoutSets as never[])
    await db.cardioEntries.bulkPut(data.cardioEntries as never[])
    await db.exercises.bulkPut(data.exercises as never[])
    await db.measurements.bulkPut(data.measurements as never[])
    await db.goals.bulkPut(data.goals as never[])
  })
  return { restored: true, reason: `Restored ${data.workouts.length} workouts and ${data.measurements.length} measurements` }
}
