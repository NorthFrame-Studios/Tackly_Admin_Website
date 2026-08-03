import type { Report, ReportPriority, ReportStatus } from '../types/database'

export interface ReportFilterValues {
  search: string
  status: ReportStatus | 'all'
  priority: ReportPriority | 'all'
  type: 'all' | 'listing' | 'user' | 'image' | 'message'
}

export function filterReports(reports: Report[], filters: ReportFilterValues): Report[] {
  const query = filters.search.trim().toLocaleLowerCase('da-DK')
  return reports.filter((report) => {
    const typeMatches =
      filters.type === 'all' ||
      (filters.type === 'listing' && Boolean(report.listing_id)) ||
      (filters.type === 'user' && Boolean(report.reported_user_id)) ||
      (filters.type === 'image' && Boolean(report.listing_image_id)) ||
      (filters.type === 'message' && Boolean(report.message_id))
    const haystack = [
      report.id,
      report.reason,
      report.details,
      report.listing?.title,
      report.reported_user?.display_name,
      report.reporter?.display_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('da-DK')
    return (
      (filters.status === 'all' || report.status === filters.status) &&
      (filters.priority === 'all' || report.priority === filters.priority) &&
      typeMatches &&
      (!query || haystack.includes(query))
    )
  })
}

export function getReportType(report: Report): string {
  if (report.message_id) return 'Besked'
  if (report.listing_image_id) return 'Billede'
  if (report.listing_id) return 'Annonce'
  if (report.reported_user_id) return 'Bruger'
  return 'Andet'
}
