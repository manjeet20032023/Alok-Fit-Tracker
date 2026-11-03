import { describe, expect, it } from 'vitest'
import { restoreBackup, validateBackup } from './import'

describe('backup import validation', () => {
  it('accepts earlier backups and defaults newer collections', () => {
    const result = validateBackup(JSON.stringify({ exportedAt: '2026-11-03T00:00:00.000Z', workouts: [] }))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.personalRecords).toEqual([])
      expect(result.data.progressPhotos).toEqual([])
    }
  })

  it('rejects malformed JSON and malformed photo data', () => {
    expect(() => validateBackup('{')).toThrow('not valid JSON')
    const result = validateBackup(JSON.stringify({
      exportedAt: '2026-11-03T00:00:00.000Z',
      progressPhotos: [{ id: 'photo-1', contentType: 'image/jpeg', dataUrl: 'data:image/png;base64,AA==' }],
    }))

    expect(result.success).toBe(false)
  })

  it('does not modify data when the backup structure is invalid', async () => {
    await expect(restoreBackup('{"exportedAt": 1}')).resolves.toMatchObject({ restored: false })
  })
})