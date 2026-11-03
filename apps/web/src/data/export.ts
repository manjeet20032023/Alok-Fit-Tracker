import { db } from './db'

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function exportJSON() {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    profiles: await db.profiles.toArray(),
    workouts: await db.workouts.toArray(),
    workoutExercises: await db.workoutExercises.toArray(),
    workoutSets: await db.workoutSets.toArray(),
    cardioEntries: await db.cardioEntries.toArray(),
    exercises: await db.exercises.toArray(),
    measurements: await db.measurements.toArray(),
    goals: await db.goals.toArray(),
  }
  download(`alok-fit-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), 'application/json')
}

export async function exportCSV() {
  const workouts = await db.workouts.toArray()
  const sets = await db.workoutSets.toArray()
  const exercises = await db.workoutExercises.toArray()
  const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  const workoutDate = new Map(workouts.map((workout) => [workout.id, workout.localDate]))
  const rows = [['date', 'exercise', 'set', 'reps', 'weight_kg', 'duration_seconds', 'completed']]
  for (const set of sets) rows.push([workoutDate.get(set.workoutId) ?? '', nameById.get(set.workoutExerciseId) ?? '', String(set.setNumber), set.reps == null ? '' : String(set.reps), set.weightKg == null ? '' : String(set.weightKg), set.durationSeconds == null ? '' : String(set.durationSeconds), String(set.completed)])
  const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n')
  download(`alok-fit-workout-sets-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
}
