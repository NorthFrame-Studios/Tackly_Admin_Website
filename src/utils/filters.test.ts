import { describe, expect, it } from 'vitest'
import type { Report } from '../types/database'
import { filterReports } from './filters'

const base: Report = {
  id: 'report-1', reporter_id: 'reporter', reported_user_id: 'target', listing_id: null,
  listing_image_id: null, message_id: null, reason: 'Spam', details: 'Gentagne beskeder',
  status: 'open', priority: 'high', assigned_admin_id: null, resolution: null,
  created_at: '2026-08-01T10:00:00Z', reviewed_at: null, resolved_at: null,
  reported_user: { id: 'target', display_name: 'Anna Jensen', avatar_url: null, location: null },
}

describe('filterReports', () => {
  it('filtrerer på status, prioritet, type og tekst', () => {
    const reports = [base, { ...base, id: 'report-2', status: 'resolved' as const, priority: 'low' as const, reported_user_id: null, listing_id: 'listing-1', reason: 'Dublet' }]
    expect(filterReports(reports, { search: 'Anna', status: 'open', priority: 'high', type: 'user' })).toEqual([base])
    expect(filterReports(reports, { search: 'dublet', status: 'all', priority: 'all', type: 'listing' })).toHaveLength(1)
  })
})
