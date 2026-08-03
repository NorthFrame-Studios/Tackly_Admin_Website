import { CheckCircle2, LockKeyhole, Send } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Avatar, UserSummaryCard } from '../components/Cards'
import { PageHeader } from '../components/PageHeader'
import { PriorityBadge, StatusBadge } from '../components/Badges'
import { ErrorState, LoadingState } from '../components/States'
import { useToast } from '../components/toastContext'
import { useAsync } from '../hooks/useAsync'
import { getSupportCaseById, replyToSupportCase, updateSupportCase } from '../services/supportService'
import { getUsers } from '../services/userService'
import type { ReportPriority, SupportCaseStatus } from '../types/database'
import { formatDate, shortId, supportCategoryLabel, supportEventLabel } from '../utils/format'

export function SupportDetailPage() {
  const { caseId = '' } = useParams()
  const { showToast } = useToast()
  const [message, setMessage] = useState('')
  const [internal, setInternal] = useState(false)
  const [replyStatus, setReplyStatus] = useState<SupportCaseStatus>('waiting_for_user')
  const [submitting, setSubmitting] = useState(false)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const state = useAsync(async () => {
    const [supportCase, users] = await Promise.all([getSupportCaseById(caseId), getUsers({ pageSize: 100 })])
    return { supportCase, staff: users.data.filter((user) => user.role !== 'user') }
  }, [caseId])
  if (state.loading) return <LoadingState label="Henter supportsag…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Supportsagen kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const supportCase = state.data.supportCase

  async function changeCase(values: { status?: SupportCaseStatus; priority?: ReportPriority; assignedAdminId?: string; unassign?: boolean }, success: string) {
    setMutationError(null)
    try {
      await updateSupportCase({ caseId: supportCase.id, ...values })
      showToast(success)
      await state.reload()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Sagen kunne ikke opdateres.')
    }
  }

  async function submitReply(event: React.FormEvent) {
    event.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setMutationError(null)
    try {
      await replyToSupportCase({ caseId: supportCase.id, message, internal, status: replyStatus })
      setMessage('')
      showToast(internal ? 'Den interne note er gemt.' : 'Svaret er sendt og gemt i sagen.')
      await state.reload()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Svaret kunne ikke gemmes.')
    } finally {
      setSubmitting(false)
    }
  }

  return <><PageHeader title={supportCase.subject} description={`Supportsag #${shortId(supportCase.id)} · oprettet ${formatDate(supportCase.created_at)}`} actions={<div className="header-badges"><PriorityBadge priority={supportCase.priority} /><StatusBadge status={supportCase.status} /></div>} />
    <div className="detail-layout"><div className="stack"><section className="panel"><div className="support-thread" aria-label="Samtale med support">{supportCase.messages?.map((item) => { const fromUser = item.sender_id === supportCase.user_id; return <article key={item.id} className={`support-message ${fromUser ? 'support-message--user' : 'support-message--staff'} ${item.is_internal ? 'support-message--internal' : ''}`}><div className="support-message__meta"><Avatar profile={item.sender ?? { display_name: 'Ukendt', avatar_url: null }} size="small" /><div><strong>{item.is_internal ? 'Intern note' : item.sender?.display_name ?? 'Ukendt afsender'}</strong><span>{formatDate(item.created_at)}</span></div>{item.is_internal && <LockKeyhole aria-label="Kun synlig for staff" />}</div><p>{item.body}</p></article> })}</div></section>
      <section className="panel"><h2>{internal ? 'Tilføj intern note' : 'Svar brugeren'}</h2><form className="form-stack" onSubmit={submitReply}><label className="field"><span>{internal ? 'Intern note' : 'Besked'}</span><textarea rows={6} maxLength={5000} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder={internal ? 'Kun synlig for moderatorer og administratorer…' : 'Skriv et klart og hjælpsomt svar…'} /></label><label className="confirm-check support-internal-toggle"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /><span><strong>Intern note</strong><small>Vises ikke til brugeren.</small></span></label>{!internal && <label className="field"><span>Status efter svar</span><select value={replyStatus} onChange={(event) => setReplyStatus(event.target.value as SupportCaseStatus)}><option value="waiting_for_user">Afventer bruger</option><option value="open">Åben</option><option value="resolved">Løst</option><option value="closed">Lukket</option></select></label>}{mutationError && <p className="form-error" role="alert">{mutationError}</p>}<div className="dialog-actions"><button className="button button--primary" type="submit" disabled={submitting || !message.trim()}><Send />{internal ? 'Gem intern note' : 'Send svar'}</button></div></form></section></div>
      <aside className="stack"><section className="panel"><h2>Sagsstyring</h2><div className="form-stack"><label className="field"><span>Status</span><select value={supportCase.status} onChange={(event) => void changeCase({ status: event.target.value as SupportCaseStatus }, 'Supportstatus er opdateret.')}><option value="new">Ny</option><option value="open">Åben</option><option value="waiting_for_user">Afventer bruger</option><option value="resolved">Løst</option><option value="closed">Lukket</option></select></label><label className="field"><span>Prioritet</span><select value={supportCase.priority} onChange={(event) => void changeCase({ priority: event.target.value as ReportPriority }, 'Prioriteten er opdateret.')}><option value="low">Lav</option><option value="normal">Normal</option><option value="high">Høj</option><option value="urgent">Kritisk</option></select></label><label className="field"><span>Ansvarlig</span><select value={supportCase.assigned_admin_id ?? ''} onChange={(event) => { const assignedAdminId = event.target.value; void changeCase(assignedAdminId ? { assignedAdminId } : { unassign: true }, assignedAdminId ? 'Sagen er blevet tildelt.' : 'Tildelingen er fjernet.') }}><option value="">Ikke tildelt</option>{state.data.staff.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label></div>{supportCase.status !== 'resolved' && supportCase.status !== 'closed' && <button type="button" className="button button--secondary button--wide" onClick={() => void changeCase({ status: 'resolved' }, 'Sagen er markeret som løst.')}><CheckCircle2 /> Markér som løst</button>}</section>
      <section className="panel"><h2>Bruger</h2>{supportCase.user ? <UserSummaryCard user={supportCase.user} /> : <p className="muted">Brugeren er ikke tilgængelig.</p>}</section><section className="panel"><h2>Sagsoplysninger</h2><dl className="detail-list"><div><dt>Kategori</dt><dd>{supportCategoryLabel[supportCase.category] ?? supportCase.category}</dd></div><div><dt>Seneste aktivitet</dt><dd>{formatDate(supportCase.last_message_at)}</dd></div><div><dt>Løst</dt><dd>{formatDate(supportCase.resolved_at)}</dd></div></dl></section><section className="panel"><h2>Aktivitetslog</h2>{supportCase.events?.length ? <ol className="timeline support-events">{supportCase.events.map((event) => <li key={event.id}><span className="timeline__dot" /><div><strong>{supportEventLabel[event.event_type] ?? event.event_type}</strong><span>{event.actor?.display_name ?? 'Ukendt'} · {formatDate(event.created_at)}</span></div></li>)}</ol> : <p className="muted">Der er endnu ingen registrerede hændelser.</p>}</section><Link className="text-link" to="/support">← Tilbage til support</Link></aside></div></>
}
