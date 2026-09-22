import { AlertTriangle, ClipboardCheck, FilePlus2, Flag, ShieldAlert, UserPlus, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ModerationTimeline, ReportSummaryCard, StatCard } from '../components/Cards'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { getDashboardStatistics } from '../services/dashboardService'
import { getModerationActions } from '../services/moderationService'
import { getReports } from '../services/reportService'

export function DashboardPage() {
  const state = useAsync(async () => {
    const [statistics, recentReports, urgentReports, actions] = await Promise.all([
      getDashboardStatistics(),
      getReports({ pageSize: 5, sort: 'newest' }),
      getReports({ pageSize: 4, priority: 'urgent', status: 'open' }),
      getModerationActions({ pageSize: 6 }),
    ])
    return { statistics, recentReports: recentReports.data, urgentReports: urgentReports.data, actions: actions.data }
  }, [])
  if (state.loading) return <LoadingState label="Henter markedsstatus…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Dashboardet kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const { statistics: stats } = state.data
  return (
    <><PageHeader title="God arbejdslyst" description="Her er den aktuelle status for Tackly-markedspladsen." actions={<Link to="/reports?status=open" className="button button--primary"><Flag /> Behandl anmeldelser</Link>} />
      <section className="stats-grid" aria-label="Markedsstatistik"><StatCard label="Åbne anmeldelser" value={stats.open_reports} change={stats.reports_change_7d} icon={<Flag />} /><StatCard label="Høj prioritet" value={stats.high_priority_reports} icon={<ShieldAlert />} /><StatCard label="I behandling" value={stats.under_review_reports} icon={<ClipboardCheck />} /><StatCard label="Fjernede annoncer" value={stats.removed_listings} icon={<AlertTriangle />} /><StatCard label="Suspenderede brugere" value={stats.suspended_users} icon={<UsersRound />} /><StatCard label="Nye brugere · 30 dage" value={stats.new_users_30d} change={stats.users_change_30d} icon={<UserPlus />} /><StatCard label="Nye annoncer · 30 dage" value={stats.new_listings_30d} change={stats.listings_change_30d} icon={<FilePlus2 />} /></section>
      <div className="dashboard-grid"><section className="panel"><div className="panel__header"><div><h2>Seneste anmeldelser</h2><p>Nye sager på tværs af markedspladsen.</p></div><Link to="/reports" className="text-link">Se alle</Link></div>{state.data.recentReports.length ? <div className="report-list">{state.data.recentReports.map((report) => <ReportSummaryCard key={report.id} report={report} />)}</div> : <EmptyState title="Ingen anmeldelser" description="Der er ingen anmeldelser at vise." />}</section>
        <aside className="stack"><section className="panel attention-panel"><div className="panel__header"><div><h2>Kræver opmærksomhed</h2><p>Åbne sager med kritisk prioritet.</p></div></div>{state.data.urgentReports.length ? <div className="report-list compact">{state.data.urgentReports.map((report) => <ReportSummaryCard key={report.id} report={report} />)}</div> : <EmptyState title="Alt ser roligt ud" description="Ingen kritiske, åbne anmeldelser." />}</section><section className="panel"><div className="panel__header"><div><h2>Hurtige handlinger</h2></div></div><div className="quick-actions"><Link to="/reports?status=open"><Flag />Åbne anmeldelser</Link><Link to="/listings?reported=true"><AlertTriangle />Anmeldte annoncer</Link><Link to="/users?status=suspended"><UsersRound />Suspenderede brugere</Link></div></section></aside>
      </div><section className="panel"><div className="panel__header"><div><h2>Seneste moderation</h2><p>Uforanderlig aktivitet fra administratorer og moderatorer.</p></div><Link to="/moderation-log" className="text-link">Åbn log</Link></div><ModerationTimeline actions={state.data.actions} /></section></>
  )
}
