import { describe, expect, it } from 'vitest'
import { isStaffRole } from './authService'

describe('rollebaseret adgang', () => {
  it('afhænger af rolle og aldrig af e-mailadresse', () => {
    expect(isStaffRole('user')).toBe(false)
    expect(isStaffRole('moderator')).toBe(true)
    expect(isStaffRole('admin')).toBe(true)
  })
})
