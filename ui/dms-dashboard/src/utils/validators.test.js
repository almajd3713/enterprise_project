import { describe, expect, it } from 'vitest'
import {
  normalizeApiBaseUrl,
  validateSettingsDraft,
  validateUserInput,
} from './validators'

describe('normalizeApiBaseUrl', () => {
  it('uses /api as fallback', () => {
    expect(normalizeApiBaseUrl('')).toBe('/api')
  })

  it('trims trailing slash', () => {
    expect(normalizeApiBaseUrl('http://localhost:30090/api/')).toBe(
      'http://localhost:30090/api',
    )
  })
})

describe('validateUserInput', () => {
  it('flags missing name and email', () => {
    const issues = validateUserInput({ name: '', email: '' })
    expect(issues.length).toBeGreaterThanOrEqual(2)
  })

  it('accepts valid values', () => {
    expect(
      validateUserInput({ name: 'Aya K', email: 'aya@example.com' }),
    ).toEqual([])
  })
})

describe('validateSettingsDraft', () => {
  it('flags invalid numeric thresholds', () => {
    const issues = validateSettingsDraft({
      brandName: 'DMS',
      timezone: 'Africa/Algiers',
      retentionDays: 0,
      thresholdP95: 0,
      thresholdErrorRate: -1,
    })

    expect(issues.length).toBeGreaterThan(0)
  })

  it('accepts a healthy settings object', () => {
    expect(
      validateSettingsDraft({
        brandName: 'DMS',
        timezone: 'Africa/Algiers',
        retentionDays: 30,
        thresholdP95: 500,
        thresholdErrorRate: 3,
      }),
    ).toEqual([])
  })
})
