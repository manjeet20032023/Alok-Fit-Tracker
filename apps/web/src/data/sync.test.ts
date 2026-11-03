import { describe, expect, it } from 'vitest'
import { shouldApplyRemoteTombstone } from './sync'
import type { SyncOutboxItem } from './db'

const pendingItem: SyncOutboxItem = {
  id: 'outbox-1', entityType: 'workoutExercises', entityId: 'exercise-1', operation: 'upsert',
  payload: '{}', revision: 1, attempts: 0, status: 'pending', createdAt: '', updatedAt: '',
}

describe('remote deletion tombstones', () => {
  it('does not replace a newer local edit that is still queued', () => {
    expect(shouldApplyRemoteTombstone([pendingItem], 'workoutExercises', 'exercise-1')).toBe(false)
  })

  it('applies remote deletion when no local change is pending', () => {
    expect(shouldApplyRemoteTombstone([], 'workoutExercises', 'exercise-1')).toBe(true)
  })

  it('does not let another record pending update block a deletion', () => {
    expect(shouldApplyRemoteTombstone([pendingItem], 'workoutExercises', 'exercise-2')).toBe(true)
  })
})