import type { Workout, WorkoutExercise, WorkoutSet } from '../data/db'

export interface WorkoutDayGroup {
  localDate: string
  workouts: Workout[]
  focus: string[]
  locations: string[]
  durationSeconds: number
}

export interface ExerciseSetSummary {
  exerciseName: string
  muscleGroup: string
  sets: WorkoutSet[]
}

export interface MuscleGroupComparison {
  workout: Workout
  exercises: ExerciseSetSummary[]
  totalVolumeKg: number
}

export function groupWorkoutsByDate(workouts: Workout[]): WorkoutDayGroup[] {
  const grouped = new Map<string, Workout[]>()
  for (const workout of workouts) {
    if (workout.deletedAt) continue
    grouped.set(workout.localDate, [...(grouped.get(workout.localDate) ?? []), workout])
  }
  return [...grouped.entries()]
    .map(([localDate, dayWorkouts]) => ({
      localDate,
      workouts: dayWorkouts,
      focus: [...new Set(dayWorkouts.flatMap((workout) => workout.plannedFocus))],
      locations: [...new Set(dayWorkouts.map((workout) => workout.location).filter((location): location is 'gym' | 'home' | 'other' => Boolean(location)))],
      durationSeconds: dayWorkouts.reduce((total, workout) => total + (workout.durationSeconds ?? 0), 0),
    }))
    .sort((left, right) => right.localDate.localeCompare(left.localDate))
}

export function getPreviousMuscleGroupComparison(
  workouts: Workout[],
  exercises: WorkoutExercise[],
  sets: WorkoutSet[],
  beforeDate: string,
  muscleGroup: string,
): MuscleGroupComparison | null {
  const target = muscleGroup.trim().toLocaleLowerCase()
  if (!target) return null
  const previous = workouts
    .filter((workout) => workout.status === 'completed' && !workout.deletedAt && workout.localDate < beforeDate)
    .sort((left, right) => right.localDate.localeCompare(left.localDate) || (right.completedAt ?? '').localeCompare(left.completedAt ?? ''))

  for (const workout of previous) {
    const matchedExercises = exercises
      .filter((exercise) => exercise.workoutId === workout.id && exercise.section === 'weight' && exercise.muscleGroup.split(',').some((tag) => tag.trim().toLocaleLowerCase() === target))
      .map((exercise) => ({
        exerciseName: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sets: sets.filter((set) => set.workoutExerciseId === exercise.id),
      }))
      .filter((exercise) => exercise.sets.length > 0)
    if (!matchedExercises.length) continue
    const totalVolumeKg = matchedExercises.flatMap((exercise) => exercise.sets)
      .filter((set) => set.completed && set.weightKg != null && set.reps != null)
      .reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0)
    return { workout, exercises: matchedExercises, totalVolumeKg }
  }
  return null
}