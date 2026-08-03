import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StatusBadge } from '../components/Badges'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { getListings } from '../services/listingService'
import type { Listing } from '../types/database'
import { formatCurrency, formatDate } from '../utils/format'

const PAGE_SIZE = 25
const categories = ['Rytter', 'Hest', 'Sadler', 'Stald', 'Andet']

export function ListingsPage() {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const search = params.get('search') ?? ''
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const sellerId = params.get('seller') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const reportedOnly = params.get('reported') === 'true'
  const state = useAsync(() => getListings({ search, status, category, sellerId, from: from || undefined, to: to ? `${to}T23:59:59.999Z` : undefined, reportedOnly, page, pageSize: PAGE_SIZE }), [search, status, category, sellerId, from, to, reportedOnly, page])
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); setPage(1) }
  const columns: Column<Listing>[] = [
    { key: 'image', header: 'Foto', render: (row) => row.images?.[0]?.public_url ? <img className="table-thumb" src={row.images[0].public_url} alt="" /> : <span className="table-thumb table-thumb--empty">—</span> },
    { key: 'title', header: 'Annonce', render: (row) => <div className="cell-primary"><strong>{row.title}</strong><span>{row.category}{row.subcategory ? ` · ${row.subcategory}` : ''}</span></div> },
    { key: 'seller', header: 'Sælger', render: (row) => row.seller?.display_name ?? 'Ukendt' },
    { key: 'price', header: 'Pris', render: (row) => formatCurrency(row.price) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'reports', header: 'Anmeldelser', render: (row) => row.report_count ?? 0 },
    { key: 'created', header: 'Oprettet', render: (row) => formatDate(row.created_at) },
    { key: 'open', header: '', render: (row) => <Link className="icon-button" to={`/listings/${row.id}`} aria-label={`Åbn ${row.title}`}><ChevronRight /></Link> },
  ]
  return <><PageHeader title="Annoncer" description="Søg i hele markedspladsen og gennemgå annoncehistorik." /><div className="filter-bar"><SearchInput value={search} onChange={(value) => update('search', value)} placeholder="Søg titel eller beskrivelse…" /><label><span>Status</span><select value={status} onChange={(event) => update('status', event.target.value)}><option value="">Alle</option><option value="active">Aktiv</option><option value="reserved">Reserveret</option><option value="sold">Solgt</option><option value="archived">Arkiveret</option><option value="hidden">Skjult</option><option value="removed_by_moderator">Fjernet</option></select></label><label><span>Kategori</span><select value={category} onChange={(event) => update('category', event.target.value)}><option value="">Alle</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Sælger-ID</span><input value={sellerId} onChange={(event) => update('seller', event.target.value)} placeholder="Alle sælgere" /></label><label><span>Fra dato</span><input type="date" value={from} onChange={(event) => update('from', event.target.value)} /></label><label><span>Til dato</span><input type="date" value={to} onChange={(event) => update('to', event.target.value)} /></label><label className="checkbox-filter"><input type="checkbox" checked={reportedOnly} onChange={(event) => update('reported', event.target.checked ? 'true' : '')} /><span>Kun anmeldte</span></label></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => void state.reload()} /> : state.data?.data.length ? <div className="panel panel--table"><DataTable columns={columns} rows={state.data.data} label="Annoncer" /><Pagination page={page} pageSize={PAGE_SIZE} count={state.data.count} onChange={setPage} /></div> : <EmptyState title="Ingen annoncer fundet" description="Prøv at ændre søgning eller filtre." />}</>
}
