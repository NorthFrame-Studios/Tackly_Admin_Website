import { Ban, CheckCircle2, EyeOff, Flag, RotateCcw, ShieldAlert, UserRoundX, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PriorityBadge, RoleBadge, StatusBadge } from '../components/Badges'
import { ListingSummaryCard, ModerationTimeline, ReportSummaryCard, UserSummaryCard } from '../components/Cards'
import { ActionDialog } from '../components/Dialogs'
import { ImageGallery } from '../components/ImageGallery'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useToast } from '../components/toastContext'
import { useAuth } from '../features/auth/authContext'
import { useAsync } from '../hooks/useAsync'
import { getModerationActions, performModerationAction } from '../services/moderationService'
import { getRelatedReports, getReportById } from '../services/reportService'
import { getUserById } from '../services/userService'
import type { ListingImage, ModerationActionType } from '../types/database'
import { formatCurrency, formatDate, shortId } from '../utils/format'

const successText: Record<ModerationActionType, string> = {
  mark_under_review: 'Anmeldelsen er markeret som under behandling.', dismiss_report: 'Anmeldelsen er blevet afvist.',
  hide_image: 'Billedet er blevet skjult.', restore_image: 'Billedet er blevet gendannet.',
  remove_listing: 'Annoncen er blevet fjernet.', restore_listing: 'Annoncen er blevet gendannet.',
  warn_user: 'Advarslen er registreret.', suspend_user: 'Brugeren er blevet suspenderet.',
  unsuspend_user: 'Suspenderingen er ophævet.', ban_user: 'Brugeren er blevet udelukket.',
  change_user_role: 'Brugerrollen er ændret.', resolve_report: 'Anmeldelsen er markeret som løst.',
}

interface SelectedAction { action: ModerationActionType; image?: ListingImage }

export function ReportDetailPage() {
  const { reportId = '' } = useParams()
  const [selected, setSelected] = useState<SelectedAction | null>(null)
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const state = useAsync(async () => {
    const report = await getReportById(reportId)
    const targetUserId = report.reported_user_id ?? report.listing?.seller_id ?? null
    const [related, actions, targetUser] = await Promise.all([
      targetUserId ? getRelatedReports(targetUserId, report.id) : Promise.resolve([]),
      getModerationActions({ targetUserId: targetUserId ?? undefined, listingId: report.listing_id ?? undefined, pageSize: 20 }),
      targetUserId ? getUserById(targetUserId) : Promise.resolve(null),
    ])
    return { report, related, actions: actions.data, targetUser, targetUserId }
  }, [reportId])

  if (state.loading) return <LoadingState label="Henter anmeldelse…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Anmeldelsen kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const report = state.data.report
  const { listing, listing_image: reportedImage } = report

  async function confirm(values: { reason: string; internalNote?: string; suspensionHours?: number }) {
    if (!selected) return
    await performModerationAction({
      action: selected.action, ...values, reportId: report.id,
      targetUserId: state.data?.targetUserId ?? undefined,
      listingId: report.listing_id ?? undefined,
      listingImageId: selected.image?.id ?? (selected.action.includes('image') ? report.listing_image_id ?? undefined : undefined),
      messageId: report.message_id ?? undefined,
    })
    showToast(successText[selected.action])
    await state.reload()
  }

  return <><PageHeader title={`Anmeldelse #${shortId(report.id)}`} description={`Oprettet ${formatDate(report.created_at)}`} actions={<div className="header-badges"><PriorityBadge priority={report.priority} /><StatusBadge status={report.status} /></div>} />
    <div className="detail-layout"><div className="stack"><section className="panel"><div className="panel__header"><div><span className="eyebrow"><Flag /> Anmeldelse</span><h2>{report.reason}</h2></div></div><dl className="detail-list"><div><dt>Forklaring</dt><dd>{report.details || 'Ingen yderligere forklaring.'}</dd></div><div><dt>Status</dt><dd><StatusBadge status={report.status} /></dd></div><div><dt>Prioritet</dt><dd><PriorityBadge priority={report.priority} /></dd></div><div><dt>Ansvarlig</dt><dd>{report.assigned_admin?.display_name ?? 'Ikke tildelt'}</dd></div><div><dt>Oprettet</dt><dd>{formatDate(report.created_at)}</dd></div>{report.resolution && <div><dt>Afgørelse</dt><dd>{report.resolution}</dd></div>}</dl></section>
      {listing && <section className="panel"><div className="panel__header"><div><h2>Anmeldt annonce</h2><p>Den komplette annonce som den ser ud i databasen.</p></div><Link to={`/listings/${listing.id}`} className="text-link">Åbn annoncen</Link></div><ListingSummaryCard listing={listing} /><dl className="detail-list detail-list--columns"><div><dt>Beskrivelse</dt><dd>{listing.description}</dd></div><div><dt>Pris</dt><dd>{formatCurrency(listing.price)}</dd></div><div><dt>Kategori</dt><dd>{listing.category}{listing.subcategory ? ` · ${listing.subcategory}` : ''}</dd></div><div><dt>Stand</dt><dd>{listing.condition}</dd></div><div><dt>Placering</dt><dd>{listing.location}</dd></div><div><dt>Oprettet</dt><dd>{formatDate(listing.created_at)}</dd></div></dl><h3>Annoncebilleder</h3><ImageGallery images={listing.images ?? []} onAction={(image, action) => setSelected({ action, image })} /></section>}
      {reportedImage && !listing?.images?.some((image) => image.id === reportedImage.id) && <section className="panel"><h2>Anmeldt billede</h2><ImageGallery images={[reportedImage]} onAction={(image, action) => setSelected({ action, image })} /></section>}
      {report.message && <section className="panel"><h2>Anmeldt besked</h2><blockquote className="message-preview">{report.message.content}</blockquote><p className="muted">Sendt {formatDate(report.message.created_at)}</p></section>}
      <section className="panel"><div className="panel__header"><div><h2>Moderationshistorik</h2><p>Alle handlinger gemmes i den uforanderlige log.</p></div></div><ModerationTimeline actions={state.data.actions} /></section></div>
      <aside className="stack"><section className="panel"><h2>Handlinger</h2><div className="action-grid">{report.status === 'open' && <button type="button" className="button button--primary" onClick={() => setSelected({ action: 'mark_under_review' })}><ShieldAlert /> Start behandling</button>}<button type="button" className="button button--secondary" onClick={() => setSelected({ action: 'dismiss_report' })}><XCircle /> Afvis anmeldelse</button>{listing && listing.status !== 'removed_by_moderator' ? <button type="button" className="button button--danger-soft" onClick={() => setSelected({ action: 'remove_listing' })}><EyeOff /> Fjern annonce</button> : listing && <button type="button" className="button button--secondary" onClick={() => setSelected({ action: 'restore_listing' })}><RotateCcw /> Gendan annonce</button>}<button type="button" className="button button--secondary" disabled={!state.data.targetUserId} onClick={() => setSelected({ action: 'warn_user' })}><ShieldAlert /> Advar bruger</button>{isAdmin && state.data.targetUser && (state.data.targetUser.account_status === 'suspended' ? <button type="button" className="button button--secondary" onClick={() => setSelected({ action: 'unsuspend_user' })}><RotateCcw /> Ophæv suspendering</button> : <button type="button" className="button button--danger-soft" onClick={() => setSelected({ action: 'suspend_user' })}><UserRoundX /> Suspender bruger</button>)}{isAdmin && <button type="button" className="button button--danger-soft" disabled={!state.data.targetUserId} onClick={() => setSelected({ action: 'ban_user' })}><Ban /> Udeluk bruger</button>}<button type="button" className="button button--primary" onClick={() => setSelected({ action: 'resolve_report' })}><CheckCircle2 /> Markér som løst</button></div></section>
      <section className="panel"><h2>Anmelder</h2>{report.reporter ? <UserSummaryCard user={report.reporter} /> : <p className="muted">Anmelderen er ikke tilgængelig.</p>}</section>
      <section className="panel"><h2>Anmeldt bruger</h2>{state.data.targetUser ? <><UserSummaryCard user={state.data.targetUser} /><div className="inline-badges"><RoleBadge role={state.data.targetUser.role} /><StatusBadge status={state.data.targetUser.account_status} /></div></> : <p className="muted">Ingen bruger er knyttet til anmeldelsen.</p>}</section>
      <section className="panel"><div className="panel__header"><div><h2>Tidligere anmeldelser</h2></div></div>{state.data.related.length ? <div className="report-list compact">{state.data.related.map((item) => <ReportSummaryCard key={item.id} report={item} />)}</div> : <EmptyState title="Ingen tidligere sager" description="Der er ikke fundet andre anmeldelser af brugeren." />}</section></aside></div>
    {selected && <ActionDialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} action={selected.action} targetLabel={listing?.title ?? state.data.targetUser?.display_name} onConfirm={confirm} />}</>
}
