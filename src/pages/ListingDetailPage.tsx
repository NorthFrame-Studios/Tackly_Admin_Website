import { EyeOff, Flag, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '../components/Badges'
import { ModerationTimeline, ReportSummaryCard, UserSummaryCard } from '../components/Cards'
import { ActionDialog } from '../components/Dialogs'
import { ImageGallery } from '../components/ImageGallery'
import { PageHeader } from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useToast } from '../components/toastContext'
import { useAsync } from '../hooks/useAsync'
import { getListingById } from '../services/listingService'
import { getModerationActions, performModerationAction } from '../services/moderationService'
import { getReports } from '../services/reportService'
import type { ListingImage, ModerationActionType } from '../types/database'
import { formatCurrency, formatDate } from '../utils/format'

export function ListingDetailPage() {
  const { listingId = '' } = useParams()
  const [selection, setSelection] = useState<{ action: ModerationActionType; image?: ListingImage } | null>(null)
  const { showToast } = useToast()
  const state = useAsync(async () => {
    const [listing, reports, actions] = await Promise.all([getListingById(listingId), getReports({ listingId, pageSize: 20 }), getModerationActions({ listingId, pageSize: 20 })])
    return { listing, reports: reports.data, actions: actions.data }
  }, [listingId])
  if (state.loading) return <LoadingState label="Henter annonce…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Annoncen kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const { listing } = state.data
  async function confirm(values: { reason: string; internalNote?: string }) {
    if (!selection) return
    await performModerationAction({ action: selection.action, ...values, listingId: listing.id, listingImageId: selection.image?.id, targetUserId: listing.seller_id })
    showToast(selection.action === 'remove_listing' ? 'Annoncen er blevet fjernet.' : selection.action === 'restore_listing' ? 'Annoncen er blevet gendannet.' : selection.action === 'hide_image' ? 'Billedet er blevet skjult.' : 'Billedet er blevet gendannet.')
    await state.reload()
  }
  return <><PageHeader title={listing.title} description={`Annonce oprettet ${formatDate(listing.created_at)}`} actions={<div className="page-header__actions"><StatusBadge status={listing.status} />{listing.status === 'removed_by_moderator' ? <button type="button" className="button button--secondary" onClick={() => setSelection({ action: 'restore_listing' })}><RotateCcw /> Gendan annonce</button> : <button type="button" className="button button--danger-soft" onClick={() => setSelection({ action: 'remove_listing' })}><EyeOff /> Fjern annonce</button>}</div>} />
    <div className="detail-layout"><div className="stack"><section className="panel"><dl className="detail-list detail-list--columns"><div><dt>Beskrivelse</dt><dd>{listing.description}</dd></div><div><dt>Pris</dt><dd>{formatCurrency(listing.price)}</dd></div><div><dt>Kategori</dt><dd>{listing.category}{listing.subcategory ? ` · ${listing.subcategory}` : ''}</dd></div><div><dt>Stand</dt><dd>{listing.condition}</dd></div><div><dt>Placering</dt><dd>{listing.location}</dd></div><div><dt>Opdateret</dt><dd>{formatDate(listing.updated_at)}</dd></div></dl><h2>Billeder</h2><ImageGallery images={listing.images ?? []} onAction={(image, action) => setSelection({ image, action })} /></section><section className="panel"><div className="panel__header"><div><h2>Moderationshistorik</h2></div></div><ModerationTimeline actions={state.data.actions} /></section></div>
      <aside className="stack"><section className="panel"><h2>Sælger</h2>{listing.seller ? <UserSummaryCard user={listing.seller} /> : <p className="muted">Sælgeren er ikke tilgængelig.</p>}</section><section className="panel"><div className="panel__header"><div><h2>Anmeldelser</h2></div>{state.data.reports.length > 0 && <Link to={`/reports?search=${listing.id}`} className="text-link">Se alle</Link>}</div>{state.data.reports.length ? <div className="report-list compact">{state.data.reports.map((report) => <ReportSummaryCard key={report.id} report={report} />)}</div> : <EmptyState title="Ingen anmeldelser" description="Annoncen er ikke blevet anmeldt." />}</section><section className="panel"><h2>Direkte links</h2><a className="button button--secondary button--wide" href={`https://equilo.dk/listing/${listing.id}`} target="_blank" rel="noreferrer">Forhåndsvis offentlig annonce</a><Link className="button button--secondary button--wide" to={`/reports?search=${listing.id}`}><Flag /> Åbn tilknyttede anmeldelser</Link></section></aside></div>
    {selection && <ActionDialog open onOpenChange={(open) => !open && setSelection(null)} action={selection.action} targetLabel={listing.title} onConfirm={confirm} />}</>
}
