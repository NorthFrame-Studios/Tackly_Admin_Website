import type { AccountStatus, ReportPriority, ReportStatus, UserRole } from '../types/database'
import { accountStatusLabel, listingStatusLabel, priorityLabel, reportStatusLabel, roleLabel } from '../utils/format'

export function StatusBadge({ status }: { status: ReportStatus | AccountStatus | string }) {
  const label = reportStatusLabel[status as ReportStatus] ?? accountStatusLabel[status as AccountStatus] ?? listingStatusLabel[status] ?? status
  return <span className={`badge badge--${status}`}>{label}</span>
}

export function PriorityBadge({ priority }: { priority: ReportPriority }) {
  return <span className={`badge badge--priority-${priority}`}>{priorityLabel[priority]}</span>
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`badge badge--role-${role}`}>{roleLabel[role]}</span>
}
