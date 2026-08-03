import { Ban, RotateCcw, ShieldAlert, UserCog, UserRoundX } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { RoleBadge, StatusBadge } from '../components/Badges'
import { Avatar, ListingSummaryCard, ModerationTimeline, ReportSummaryCard } from '../components/Cards'
import { ActionDialog } from '../components/Dialogs'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useToast } from '../components/toastContext'
import { useAuth } from '../features/auth/authContext'
import { useAsync } from '../hooks/useAsync'
import { getListings } from '../services/listingService'
import { getModerationActions, performModerationAction } from '../services/moderationService'
import { getReports, getReportsAgainstUser } from '../services/reportService'
import { getUserById } from '../services/userService'
import type { ModerationActionType, UserRole } from '../types/database'
import { formatDate } from '../utils/format'

export function UserDetailPage() {
  const { userId = '' } = useParams()
  const [action, setAction] = useState<ModerationActionType | null>(null)
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const state = useAsync(async () => {
    const [user, listings, received, submitted, actions] = await Promise.all([
      getUserById(userId), getListings({ sellerId: userId, pageSize: 10 }),
      getReportsAgainstUser(userId, 10), getReports({ reporterId: userId, pageSize: 10 }),
      getModerationActions({ targetUserId: userId, pageSize: 30 }),
    ])
    return { user, listings: listings.data, received, submitted: submitted.data, actions: actions.data }
  }, [userId])
  if (state.loading) return <LoadingState label="Henter bruger…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Brugeren kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const { user } = state.data
  async function confirm(values: { reason: string; internalNote?: string; suspensionHours?: number; newRole?: UserRole }) {
    if (!action) return
    await performModerationAction({ action, ...values, targetUserId: user.id })
    const labels: Partial<Record<ModerationActionType, string>> = { warn_user: 'Advarslen er registreret.', suspend_user: 'Brugeren er blevet suspenderet.', unsuspend_user: 'Suspenderingen er ophævet.', ban_user: 'Brugeren er blevet udelukket.', change_user_role: 'Brugerrollen er ændret.' }
    showToast(labels[action] ?? 'Handlingen er gennemført.')
    await state.reload()
  }
  return <><PageHeader title={user.display_name} description={user.email ?? 'Ingen e-mail tilgængelig'} actions={<div className="header-badges"><RoleBadge role={user.role} /><StatusBadge status={user.account_status} /></div>} />
    <div className="detail-layout"><div className="stack"><section className="panel"><div className="profile-hero"><Avatar profile={user} size="large" /><div><h2>{user.display_name}</h2><p>{user.bio || 'Ingen profiltekst.'}</p><span>{user.location || 'Placering ikke angivet'}</span></div></div><dl className="detail-list detail-list--columns"><div><dt>Bruger-ID</dt><dd className="mono">{user.id}</dd></div><div><dt>Registreret</dt><dd>{formatDate(user.created_at)}</dd></div><div><dt>Seneste aktivitet</dt><dd>{formatDate(user.last_activity_at)}</dd></div><div><dt>Annoncer</dt><dd>{user.listings_count}</dd></div><div><dt>Anmeldelser modtaget</dt><dd>{user.reports_received_count}</dd></div><div><dt>Anmeldelser indsendt</dt><dd>{user.reports_submitted_count}</dd></div>{user.suspension_reason && <div><dt>Suspenderingsårsag</dt><dd>{user.suspension_reason}</dd></div>}{user.suspended_until && <div><dt>Suspenderet indtil</dt><dd>{formatDate(user.suspended_until)}</dd></div>}{user.moderation_note && <div><dt>Intern note</dt><dd>{user.moderation_note}</dd></div>}</dl></section>
      <section className="panel"><div className="panel__header"><div><h2>Brugerens annoncer</h2></div><Link to={`/listings?seller=${user.id}`} className="text-link">Se alle</Link></div>{state.data.listings.length ? <div className="listing-list">{state.data.listings.map((listing) => <Link key={listing.id} to={`/listings/${listing.id}`}><ListingSummaryCard listing={listing} /></Link>)}</div> : <EmptyState title="Ingen annoncer" description="Brugeren har ingen annoncer." />}</section>
      <section className="panel"><div className="panel__header"><div><h2>Moderations- og advarselshistorik</h2></div></div><ModerationTimeline actions={state.data.actions} /></section></div>
      <aside className="stack"><section className="panel"><h2>Kontohandlinger</h2><div className="action-grid"><button type="button" className="button button--secondary" onClick={() => setAction('warn_user')}><ShieldAlert /> Advar bruger</button>{isAdmin && (user.account_status === 'suspended' ? <button type="button" className="button button--secondary" onClick={() => setAction('unsuspend_user')}><RotateCcw /> Ophæv suspendering</button> : <button type="button" className="button button--danger-soft" onClick={() => setAction('suspend_user')}><UserRoundX /> Suspender bruger</button>)}{isAdmin && <button type="button" className="button button--danger-soft" onClick={() => setAction('ban_user')}><Ban /> Udeluk bruger</button>}{isAdmin && <button type="button" className="button button--secondary" onClick={() => setAction('change_user_role')}><UserCog /> Skift rolle</button>}</div></section>
      <section className="panel"><h2>Anmeldelser mod brugeren</h2>{state.data.received.length ? <div className="report-list compact">{state.data.received.map((report) => <ReportSummaryCard key={report.id} report={report} />)}</div> : <EmptyState title="Ingen anmeldelser" description="Brugeren er ikke blevet anmeldt." />}</section><section className="panel"><h2>Indsendte anmeldelser</h2>{state.data.submitted.length ? <div className="report-list compact">{state.data.submitted.map((report) => <ReportSummaryCard key={report.id} report={report} />)}</div> : <EmptyState title="Ingen indsendte anmeldelser" description="Brugeren har ikke indsendt anmeldelser." />}</section></aside></div>
    {action && <ActionDialog open onOpenChange={(open) => !open && setAction(null)} action={action} targetLabel={user.display_name} initialRole={user.role} onConfirm={confirm} />}</>
}
