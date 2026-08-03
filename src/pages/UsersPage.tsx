import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RoleBadge, StatusBadge } from '../components/Badges'
import { Avatar } from '../components/Cards'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { getUsers } from '../services/userService'
import type { AccountStatus, AdminUser, UserRole } from '../types/database'
import { formatDate } from '../utils/format'

const PAGE_SIZE = 25

export function UsersPage() {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const search = params.get('search') ?? ''
  const role = (params.get('role') ?? 'all') as UserRole | 'all'
  const accountStatus = (params.get('status') ?? 'all') as AccountStatus | 'all'
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const reportedOnly = params.get('reported') === 'true'
  const state = useAsync(() => getUsers({ search, role, accountStatus, from: from || undefined, to: to ? `${to}T23:59:59.999Z` : undefined, reportedOnly, page, pageSize: PAGE_SIZE }), [search, role, accountStatus, from, to, reportedOnly, page])
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value === 'all' || !value) next.delete(key); else next.set(key, value); setParams(next); setPage(1) }
  const columns: Column<AdminUser>[] = [
    { key: 'name', header: 'Bruger', render: (row) => <div className="user-cell"><Avatar profile={row} size="small" /><div className="cell-primary"><strong>{row.display_name}</strong><span>{row.email ?? 'E-mail skjult'}</span></div></div> },
    { key: 'role', header: 'Rolle', render: (row) => <RoleBadge role={row.role} /> },
    { key: 'status', header: 'Kontostatus', render: (row) => <StatusBadge status={row.account_status} /> },
    { key: 'listings', header: 'Annoncer', render: (row) => row.listings_count },
    { key: 'received', header: 'Anmeldt', render: (row) => row.reports_received_count },
    { key: 'submitted', header: 'Indsendt', render: (row) => row.reports_submitted_count },
    { key: 'registered', header: 'Oprettet', render: (row) => formatDate(row.created_at) },
    { key: 'activity', header: 'Seneste aktivitet', render: (row) => formatDate(row.last_activity_at) },
    { key: 'open', header: '', render: (row) => <Link className="icon-button" to={`/users/${row.id}`} aria-label={`Åbn ${row.display_name}`}><ChevronRight /></Link> },
  ]
  return <><PageHeader title="Brugere" description="Konti, roller, aktivitet og moderationshistorik." /><div className="filter-bar"><SearchInput value={search} onChange={(value) => update('search', value)} placeholder="Søg navn, e-mail eller bruger-ID…" /><label><span>Rolle</span><select value={role} onChange={(event) => update('role', event.target.value)}><option value="all">Alle</option><option value="user">Bruger</option><option value="moderator">Moderator</option><option value="admin">Administrator</option></select></label><label><span>Kontostatus</span><select value={accountStatus} onChange={(event) => update('status', event.target.value)}><option value="all">Alle</option><option value="active">Aktiv</option><option value="suspended">Suspenderet</option><option value="banned">Udelukket</option></select></label><label><span>Registreret fra</span><input type="date" value={from} onChange={(event) => update('from', event.target.value)} /></label><label><span>Registreret til</span><input type="date" value={to} onChange={(event) => update('to', event.target.value)} /></label><label className="checkbox-filter"><input type="checkbox" checked={reportedOnly} onChange={(event) => update('reported', event.target.checked ? 'true' : '')} /><span>Kun anmeldte</span></label></div>{state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} onRetry={() => void state.reload()} /> : state.data?.data.length ? <div className="panel panel--table"><DataTable columns={columns} rows={state.data.data} label="Brugere" /><Pagination page={page} pageSize={PAGE_SIZE} count={state.data.count} onChange={setPage} /></div> : <EmptyState title="Ingen brugere fundet" description="Prøv at ændre søgning eller filtre." />}</>
}
