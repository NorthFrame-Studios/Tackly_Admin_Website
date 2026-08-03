import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PriorityBadge, StatusBadge } from '../components/Badges'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { getReports } from '../services/reportService'
import { getUsers } from '../services/userService'
import type { Report, ReportPriority, ReportStatus } from '../types/database'
import { filterReports, getReportType, type ReportFilterValues } from '../utils/filters'
import { formatDate, shortId } from '../utils/format'

const PAGE_SIZE = 25

export function ReportsPage() {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState(params.get('search') ?? '')
  const status = (params.get('status') ?? 'all') as ReportStatus | 'all'
  const priority = (params.get('priority') ?? 'all') as ReportPriority | 'all'
  const type = (params.get('type') ?? 'all') as ReportFilterValues['type']
  const sort = (params.get('sort') ?? 'newest') as 'newest' | 'oldest' | 'priority' | 'status'
  const assignedAdminId = params.get('assigned') ?? ''
  const reason = params.get('reason') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const state = useAsync(async () => {
    const [reports, users] = await Promise.all([
      getReports({ status, priority, assignedAdminId, reason, from: from || undefined, to: to ? `${to}T23:59:59.999Z` : undefined, sort, page, pageSize: PAGE_SIZE }),
      getUsers({ pageSize: 100 }),
    ])
    return { reports, staff: users.data.filter((user) => user.role !== 'user') }
  }, [status, priority, assignedAdminId, reason, from, to, sort, page])
  const rows = useMemo(() => filterReports(state.data?.reports.data ?? [], { search, status: 'all', priority: 'all', type }), [state.data, search, type])
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value === 'all' || !value) next.delete(key); else next.set(key, value); setParams(next); setPage(1) }
  const columns: Column<Report>[] = [
    { key: 'id', header: 'Rapport ID', render: (row) => <span className="mono">#{shortId(row.id)}</span> },
    { key: 'type', header: 'Type', render: getReportType },
    { key: 'reason', header: 'Årsag', render: (row) => <div className="cell-primary"><strong>{row.reason}</strong><span>{row.listing?.title ?? row.reported_user?.display_name ?? '—'}</span></div> },
    { key: 'reporter', header: 'Anmelder', render: (row) => row.reporter?.display_name ?? 'Ukendt' },
    { key: 'priority', header: 'Prioritet', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created', header: 'Oprettet', render: (row) => formatDate(row.created_at) },
    { key: 'assigned', header: 'Ansvarlig', render: (row) => row.assigned_admin?.display_name ?? 'Ikke tildelt' },
    { key: 'open', header: '', render: (row) => <Link className="icon-button" to={`/reports/${row.id}`} aria-label={`Åbn anmeldelse ${shortId(row.id)}`}><ChevronRight /></Link> },
  ]
  return <><PageHeader title="Anmeldelser" description="Gennemgå, prioritér og løs indberettede sager." /><div className="filter-bar"><SearchInput value={search} onChange={setSearch} placeholder="Søg ID, årsag, bruger eller annonce…" /><label><span>Status</span><select value={status} onChange={(event) => update('status', event.target.value)}><option value="all">Alle</option><option value="open">Åben</option><option value="under_review">Under behandling</option><option value="resolved">Løst</option><option value="dismissed">Afvist</option></select></label><label><span>Prioritet</span><select value={priority} onChange={(event) => update('priority', event.target.value)}><option value="all">Alle</option><option value="urgent">Kritisk</option><option value="high">Høj</option><option value="normal">Normal</option><option value="low">Lav</option></select></label><label><span>Type</span><select value={type} onChange={(event) => update('type', event.target.value)}><option value="all">Alle</option><option value="listing">Annonce</option><option value="image">Billede</option><option value="user">Bruger</option><option value="message">Besked</option></select></label><label><span>Årsag</span><input value={reason} onChange={(event) => update('reason', event.target.value)} placeholder="Alle årsager" /></label><label><span>Ansvarlig</span><select value={assignedAdminId} onChange={(event) => update('assigned', event.target.value)}><option value="">Alle</option>{state.data?.staff.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><label><span>Fra dato</span><input type="date" value={from} onChange={(event) => update('from', event.target.value)} /></label><label><span>Til dato</span><input type="date" value={to} onChange={(event) => update('to', event.target.value)} /></label><label><span>Sortering</span><select value={sort} onChange={(event) => update('sort', event.target.value)}><option value="newest">Nyeste</option><option value="oldest">Ældste</option><option value="priority">Prioritet</option><option value="status">Status</option></select></label></div>
    {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => void state.reload()} /> : rows.length ? <div className="panel panel--table"><DataTable columns={columns} rows={rows} label="Anmeldelser" /><Pagination page={page} pageSize={PAGE_SIZE} count={state.data?.reports.count ?? 0} onChange={setPage} /></div> : <EmptyState title="Ingen anmeldelser fundet" description="Prøv at ændre dine filtre eller din søgning." />}</>
}
