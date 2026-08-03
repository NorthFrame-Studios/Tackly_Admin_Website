import { useState } from 'react'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { getModerationActions } from '../services/moderationService'
import type { ModerationAction } from '../types/database'
import { actionLabel, formatDate, shortId } from '../utils/format'

const PAGE_SIZE = 25

export function ModerationLogPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [moderatorId, setModeratorId] = useState('')
  const [targetUserId, setTargetUserId] = useState('')
  const [listingId, setListingId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const state = useAsync(() => getModerationActions({ action, moderatorId, targetUserId, listingId, from: from || undefined, to: to ? `${to}T23:59:59.999Z` : undefined, page, pageSize: PAGE_SIZE }), [action, moderatorId, targetUserId, listingId, from, to, page])
  const columns: Column<ModerationAction>[] = [
    { key: 'date', header: 'Dato', render: (row) => formatDate(row.created_at) },
    { key: 'moderator', header: 'Moderator', render: (row) => row.moderator?.display_name ?? 'Ukendt' },
    { key: 'action', header: 'Handling', render: (row) => <strong>{actionLabel[row.action] ?? row.action}</strong> },
    { key: 'target', header: 'Mål', render: (row) => row.target_user?.display_name ?? (row.listing_id ? `Annonce #${shortId(row.listing_id)}` : '—') },
    { key: 'report', header: 'Anmeldelse', render: (row) => row.report_id ? `#${shortId(row.report_id)}` : '—' },
    { key: 'reason', header: 'Begrundelse', render: (row) => row.reason },
    { key: 'note', header: 'Intern note', render: (row) => row.internal_note || '—' },
  ]
  return <><PageHeader title="Moderationslog" description="Uforanderlig historik over alle administrative handlinger." /><div className="filter-bar"><label><span>Handling</span><select value={action} onChange={(event) => { setAction(event.target.value); setPage(1) }}><option value="">Alle handlinger</option>{Object.entries(actionLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Moderator-ID</span><input value={moderatorId} onChange={(event) => setModeratorId(event.target.value)} placeholder="Alle" /></label><label><span>Målbruger-ID</span><input value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)} placeholder="Alle" /></label><label><span>Annonce-ID</span><input value={listingId} onChange={(event) => setListingId(event.target.value)} placeholder="Alle" /></label><label><span>Fra dato</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label><span>Til dato</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => void state.reload()} /> : state.data?.data.length ? <div className="panel panel--table"><DataTable columns={columns} rows={state.data.data} label="Moderationslog" /><Pagination page={page} pageSize={PAGE_SIZE} count={state.data.count} onChange={setPage} /></div> : <EmptyState title="Ingen logposter" description="Der er ingen handlinger, som matcher filtrene." />}</>
}
