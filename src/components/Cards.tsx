import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Listing, ModerationAction, PublicProfile, Report } from '../types/database'
import { actionLabel, formatCurrency, formatDate, shortId } from '../utils/format'
import { PriorityBadge, StatusBadge } from './Badges'

export function StatCard({ label, value, change, icon }: { label: string; value: number; change?: number | null; icon: React.ReactNode }) {
  return (
    <article className="stat-card"><div className="stat-card__icon">{icon}</div><div><p>{label}</p><strong>{value.toLocaleString('da-DK')}</strong>{change !== undefined && change !== null && <span className={`stat-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`}>{change > 0 ? <ArrowUpRight /> : change < 0 ? <ArrowDownRight /> : <Minus />}{Math.abs(change)} seneste periode</span>}</div></article>
  )
}

export function UserSummaryCard({ user }: { user: PublicProfile }) {
  return <div className="summary-card"><Avatar profile={user} /><div><strong>{user.display_name}</strong><span>{user.location || 'Placering ikke angivet'}</span></div><Link to={`/users/${user.id}`} className="text-link">Se bruger</Link></div>
}

export function ListingSummaryCard({ listing }: { listing: Listing }) {
  const image = listing.images?.[0]
  return <div className="listing-summary">{image?.public_url ? <img src={image.public_url} alt="" /> : <div className="image-placeholder">Ingen foto</div>}<div><strong>{listing.title}</strong><span>{formatCurrency(listing.price)} · {listing.category}</span><span>{listing.seller?.display_name ?? 'Ukendt sælger'}</span></div><StatusBadge status={listing.status} /></div>
}

export function ReportSummaryCard({ report }: { report: Report }) {
  return <Link to={`/reports/${report.id}`} className="report-card"><div><span className="mono">#{shortId(report.id)}</span><h3>{report.reason}</h3><p>{report.listing?.title ?? report.reported_user?.display_name ?? 'Generel anmeldelse'}</p></div><div><PriorityBadge priority={report.priority} /><StatusBadge status={report.status} /><time>{formatDate(report.created_at)}</time></div></Link>
}

export function ModerationTimeline({ actions }: { actions: ModerationAction[] }) {
  if (!actions.length) return <p className="muted">Ingen moderationshandlinger endnu.</p>
  return <ol className="timeline">{actions.map((item) => <li key={item.id}><span className="timeline__dot" /><div><strong>{actionLabel[item.action] ?? item.action}</strong><p>{item.reason}</p>{item.internal_note && <small>Intern note: {item.internal_note}</small>}<span>{item.moderator?.display_name ?? 'Ukendt moderator'} · {formatDate(item.created_at)}</span></div></li>)}</ol>
}

export function Avatar({ profile, size = 'medium' }: { profile: Pick<PublicProfile, 'display_name' | 'avatar_url'>; size?: 'small' | 'medium' | 'large' }) {
  return profile.avatar_url ? <img className={`avatar avatar--${size}`} src={profile.avatar_url} alt="" /> : <span className={`avatar avatar--${size} avatar--initials`} aria-hidden="true">{profile.display_name.slice(0, 2).toUpperCase()}</span>
}
