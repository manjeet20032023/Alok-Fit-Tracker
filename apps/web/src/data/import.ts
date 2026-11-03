import { z } from 'zod'
import { db } from './db'
import { enqueue } from './sync'

const entityArray = z.array(z.record(z.string(), z.unknown())).default([])
const photoArray = z.array(z.object({
  id: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  dataUrl: z.string().max(21_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/),
}).passthrough().refine((photo) => photo.dataUrl.startsWith(`data:${photo.contentType};base64,`))).default([])

const snapshotSchema = z.object({
  exportedAt: z.string(),
  profiles: entityArray,
  workouts: entityArray,
  workoutExercises: entityArray,
  workoutSets: entityArray,
  cardioEntries: entityArray,
  exercises: entityArray,
  measurements: entityArray,
  goals: entityArray,
  personalRecords: entityArray,
  progressPhotos: photoArray,
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
  const photos = data.progressPhotos.map(({ dataUrl, contentType, ...photo }) => {
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1)
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return { ...photo, contentType, blob: new Blob([bytes], { type: contentType }) }
  })
  const tables = [db.profiles, db.workouts, db.workoutExercises, db.workoutSets, db.cardioEntries, db.exercises, db.measurements, db.goals, db.personalRecords, db.progressPhotos]
  await db.transaction('rw', tables, async () => {
    await db.profiles.bulkPut(data.profiles as never[])
    await db.workouts.bulkPut(data.workouts as never[])
    await db.workoutExercises.bulkPut(data.workoutExercises as never[])
    await db.workoutSets.bulkPut(data.workoutSets as never[])
    await db.cardioEntries.bulkPut(data.cardioEntries as never[])
    await db.exercises.bulkPut(data.exercises as never[])
    await db.measurements.bulkPut(data.measurements as never[])
    await db.goals.bulkPut(data.goals as never[])
    await db.personalRecords.bulkPut(data.personalRecords as never[])
    await db.progressPhotos.bulkPut(photos as never[])
  })
  const groups = [
    ['profiles', data.profiles], ['workouts', data.workouts], ['workoutExercises', data.workoutExercises],
    ['workoutSets', data.workoutSets], ['cardioEntries', data.cardioEntries], ['exercises', data.exercises],
    ['measurements', data.measurements], ['goals', data.goals], ['personalRecords', data.personalRecords],
    ['progressPhotos', photos.filter((photo) => 'storageKey' in photo)],
  ] as const
  for (const [entityType, records] of groups) {
    for (const record of records) {
      const id = record.id
      if (typeof id !== 'string') continue
      const revisionValue = (record as Record<string, unknown>).revision
      const revision = typeof revisionValue === 'number' && revisionValue > 0 ? revisionValue : 1
      await enqueue(entityType, id, record, revision)
    }
  }
  return { restored: true, reason: `Restored ${data.workouts.length} workouts, ${data.measurements.length} measurements, ${data.personalRecords.length} personal records, and ${photos.length} photos` }
}
