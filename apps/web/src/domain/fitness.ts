export interface WorkingSet { weightKg: number | null; reps: number | null; completed: boolean }

export function calculateWeightedVolume(sets: WorkingSet[]): number {
  return sets.reduce((total, set) => {
    if (!set.completed || set.weightKg == null || set.reps == null) return total
    return total + Math.max(0, set.weightKg) * Math.max(0, set.reps)
  }, 0)
}

export function calculatePace(durationSeconds: number, distanceMeters: number | null): number | null {
  if (distanceMeters == null || distanceMeters <= 0 || durationSeconds < 0) return null
  return durationSeconds / (distanceMeters / 1000)
}

export function calculateSpeed(distanceMeters: number, durationSeconds: number): number | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null
  return distanceMeters / 1000 / (durationSeconds / 3600)
}
