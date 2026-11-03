import Dexie, { type EntityTable } from 'dexie'

export interface Profile {
  id: string
  heightCm: number
  weightKg: number
  goal: string
  weightUnit: 'kg' | 'lb'
  distanceUnit: 'km' | 'mi'
  targetMinutes: number
  theme: 'light' | 'dark'
}

export interface Workout {
  id: string
  localDate: string
  timezone: string
  plannedFocus: string[]
  status: 'in_progress' | 'paused' | 'completed' | 'abandoned'
  startedAt: string
  pausedAt: string | null
  lastResumedAt: string | null
  totalPausedSeconds: number
  completedAt: string | null
  durationSeconds: number | null
  notes: string
  createdAt: string
  updatedAt: string
  revision: number
  deletedAt: string | null
}

export interface WorkoutExercise {
  id: string
  workoutId: string
  name: string
  muscleGroup: string
  section: 'weight' | 'core'
  order: number
}

export interface WorkoutSet {
  id: string
  workoutExerciseId: string
  workoutId: string
  setNumber: number
  reps: number | null
  weightKg: number | null
  durationSeconds: number | null
  completed: boolean
  notes: string
}

export interface CardioEntry {
  id: string
  workoutId: string
  activityType: string
  durationSeconds: number
  distanceMeters: number | null
  inclinePercent: number | null
  heartRate: number | null
  calories: number | null
  notes: string
}

export interface Exercise {
  id: string
  name: string
  muscleGroups: string[]
  equipment: string
  exerciseType: 'strength' | 'bodyweight' | 'timed' | 'cardio' | 'core'
  instructions: string
  isCustom: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Measurement {
  id: string
  type: 'weight' | 'waist' | 'chest' | 'shoulders' | 'arms' | 'thighs' | 'hips' | 'custom'
  value: number
  unit: 'kg' | 'lb' | 'cm' | 'in'
  measuredAt: string
  note: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Goal {
  id: string
  name: string
  targetValue: number
  unit: string
  startValue: number
  startDate: string
  targetDate: string | null
  status: 'active' | 'paused' | 'archived' | 'completed'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ProgressPhoto {
  id: string
  category: 'front' | 'side' | 'back' | 'custom'
  capturedAt: string
  note: string
  blob: Blob
  contentType: string
  storageKey?: string | null
  fileSizeBytes?: number
  updatedAt?: string
  createdAt: string
  deletedAt: string | null
}

export interface PersonalRecord {
  id: string
  exerciseName: string
  type: 'weight' | 'reps_at_weight' | 'estimated_1rm' | 'duration' | 'distance'
  value: number
  unit: string
  workoutId: string | null
  achievedAt: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SyncOutboxItem {
  id: string
  entityType: string
  entityId: string
  operation: 'upsert' | 'delete'
  payload: string
  revision: number
  attempts: number
  status: 'pending' | 'syncing' | 'failed' | 'conflict'
  createdAt: string
  updatedAt: string
}

class AlokFitDatabase extends Dexie {
  profiles!: EntityTable<Profile, 'id'>
  workouts!: EntityTable<Workout, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  workoutSets!: EntityTable<WorkoutSet, 'id'>
  cardioEntries!: EntityTable<CardioEntry, 'id'>
  exercises!: EntityTable<Exercise, 'id'>
  measurements!: EntityTable<Measurement, 'id'>
  goals!: EntityTable<Goal, 'id'>
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>
  syncOutbox!: EntityTable<SyncOutboxItem, 'id'>
  personalRecords!: EntityTable<PersonalRecord, 'id'>

  constructor() {
    super('AlokFitTracker')
    this.version(1).stores({
      profiles: 'id',
      workouts: 'id, localDate, status, startedAt, updatedAt',
      workoutExercises: 'id, workoutId, section, order',
      workoutSets: 'id, workoutExerciseId, workoutId',
      cardioEntries: 'id, workoutId, activityType',
    })
    this.version(2).stores({
      profiles: 'id',
      workouts: 'id, localDate, status, startedAt, updatedAt',
      workoutExercises: 'id, workoutId, section, order',
      workoutSets: 'id, workoutExerciseId, workoutId',
      cardioEntries: 'id, workoutId, activityType',
      exercises: 'id, name, exerciseType, updatedAt, deletedAt',
      measurements: 'id, type, measuredAt, updatedAt, deletedAt',
      goals: 'id, status, startDate, updatedAt, deletedAt',
      progressPhotos: 'id, category, capturedAt, deletedAt',
      syncOutbox: 'id, entityType, entityId, status, updatedAt',
      personalRecords: 'id, exerciseName, type, achievedAt, updatedAt, deletedAt',
    })
  }
}

export const db = new AlokFitDatabase()

export const createId = () => crypto.randomUUID()

export const localDate = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const weeklySplit = [
  { day: 'Monday', focus: ['Chest', 'Triceps'] },
  { day: 'Tuesday', focus: ['Back', 'Biceps'] },
  { day: 'Wednesday', focus: ['Legs', 'Shoulders'] },
  { day: 'Thursday', focus: ['Chest', 'Triceps'] },
  { day: 'Friday', focus: ['Back', 'Biceps'] },
  { day: 'Saturday', focus: ['Rest'] },
  { day: 'Sunday', focus: ['Rest'] },
]
