import { ChevronRight, Clock3, Inbox, MessageSquareText } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PriorityBadge, StatusBadge } from '../components/Badges'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader } from '../components/PageHeader'
import { Pagination } from '../components/Pagination'
import { SearchInput } from '../components/SearchInput'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { useAsync } from '../hooks/useAsync'
import { getSupportCases } from '../services/supportService'
import { getUsers } from '../services/userService'
import type { ReportPriority, SupportCase, SupportCaseStatus } from '../types/database'
import { formatDate, shortId, supportCategoryLabel } from '../utils/format'

const PAGE_SIZE = 25

export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const [page, setPage] = useState(1)
  const search = params.get('search') ?? ''
  const status = (params.get('status') ?? 'all') as SupportCaseStatus | 'all'
  const priority = (params.get('priority') ?? 'all') as ReportPriority | 'all'
  const assignedAdminId = params.get('assigned') ?? ''
  const state = useAsync(async () => {
    const [cases, users] = await Promise.all([
      getSupportCases({ search, status, priority, assignedAdminId, page, pageSize: PAGE_SIZE }),
      getUsers({ pageSize: 100 }),
    ])
    return { cases, staff: users.data.filter((user) => user.role !== 'user') }
  }, [search, status, priority, assignedAdminId, page])

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next)
    setPage(1)
  }
  const columns: Column<SupportCase>[] = [
    { key: 'id', header: 'Sag', render: (row) => <span className="mono">#{shortId(row.id)}</span> },
    { key: 'subject', header: 'Emne', render: (row) => <div className="cell-primary"><strong>{row.subject}</strong><span>{supportCategoryLabel[row.category] ?? row.category} · {row.user?.display_name ?? 'Ukendt bruger'}</span></div> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'priority', header: 'Prioritet', render: (row) => <PriorityBadge priority={row.priority} /> },
    { key: 'messages', header: 'Beskeder', render: (row) => row.message_count ?? 0 },
    { key: 'assigned', header: 'Ansvarlig', render: (row) => row.assigned_admin?.display_name ?? 'Ikke tildelt' },
    { key: 'updated', header: 'Seneste aktivitet', render: (row) => formatDate(row.last_message_at) },
    { key: 'open', header: '', render: (row) => <Link className="icon-button" to={`/support/${row.id}`} aria-label={`Åbn supportsag ${shortId(row.id)}`}><ChevronRight /></Link> },
  ]

  return <><PageHeader title="Support" description="Behandl supporthenvendelser og svar brugerne direkte fra Tackly Admin." />
    <section className="support-summary" aria-label="Supportstatus"><div><Inbox /><span><strong>{state.data?.cases.count ?? 0}</strong>Sager i resultatet</span></div><div><MessageSquareText /><span><strong>Direkte svar</strong>Gemmes sikkert i sagen</span></div><div><Clock3 /><span><strong>Fælles indbakke</strong>Tildeling og status samlet</span></div></section>
    <div className="filter-bar"><SearchInput value={search} onChange={(value) => update('search', value)} placeholder="Søg emne eller sags-ID…" /><label><span>Status</span><select value={status} onChange={(event) => update('status', event.target.value)}><option value="all">Alle</option><option value="new">Ny</option><option value="open">Åben</option><option value="waiting_for_user">Afventer bruger</option><option value="resolved">Løst</option><option value="closed">Lukket</option></select></label><label><span>Prioritet</span><select value={priority} onChange={(event) => update('priority', event.target.value)}><option value="all">Alle</option><option value="urgent">Kritisk</option><option value="high">Høj</option><option value="normal">Normal</option><option value="low">Lav</option></select></label><label><span>Ansvarlig</span><select value={assignedAdminId} onChange={(event) => update('assigned', event.target.value)}><option value="">Alle</option>{state.data?.staff.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label></div>
    {state.loading ? <LoadingState label="Henter supportsager…" /> : state.error ? <ErrorState message={state.error} onRetry={() => void state.reload()} /> : state.data?.cases.data.length ? <div className="panel panel--table"><DataTable columns={columns} rows={state.data.cases.data} label="Supportsager" /><Pagination page={page} pageSize={PAGE_SIZE} count={state.data.cases.count} onChange={setPage} /></div> : <EmptyState title="Ingen supportsager fundet" description="Nye henvendelser fra appen vises her, når supportintegrationen er taget i brug." />}</>
}
