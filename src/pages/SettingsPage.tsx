import { CheckCircle2, Database, Mail, Server, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { RoleBadge, StatusBadge } from '../components/Badges'
import { Avatar } from '../components/Cards'
import { ActionDialog } from '../components/Dialogs'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { useToast } from '../components/toastContext'
import { useAuth } from '../features/auth/authContext'
import { useAsync } from '../hooks/useAsync'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { performModerationAction } from '../services/moderationService'
import { getUsers } from '../services/userService'
import type { AdminUser, UserRole } from '../types/database'

const reasonTemplates = [
  'Indholdet overtræder Tacklys retningslinjer.',
  'Annoncen er vildledende eller mangler væsentlige oplysninger.',
  'Der er dokumenteret mistanke om svindel.',
  'Sagen er gennemgået, og anmeldelsen kan ikke bekræftes.',
]

export function SettingsPage() {
  const auth = useAuth()
  const { showToast } = useToast()
  const [selected, setSelected] = useState<AdminUser | null>(null)
  const state = useAsync(async () => {
    const [usersResult, connectionResult] = await Promise.all([
      getUsers({ pageSize: 100 }), supabase.auth.getSession(),
    ])
    return { staff: usersResult.data.filter((user) => user.role !== 'user'), connected: !connectionResult.error }
  }, [])
  if (state.loading) return <LoadingState />
  if (state.error || !state.data || !auth.profile) return <ErrorState message={state.error ?? 'Indstillingerne kunne ikke hentes.'} onRetry={() => void state.reload()} />
  async function changeRole(values: { reason?: string; internalNote?: string; newRole?: UserRole }) {
    if (!selected || !values.newRole) return
    await performModerationAction({ action: 'change_user_role', targetUserId: selected.id, ...values })
    showToast('Brugerrollen er ændret.')
    await state.reload()
  }
  return <><PageHeader title="Indstillinger" description="Administratorkonti, systemstatus og fælles moderationsstandarder." /><div className="settings-grid"><section className="panel"><h2>Din administratorprofil</h2><div className="profile-hero"><Avatar profile={auth.profile} size="large" /><div><h3>{auth.profile.display_name}</h3><p>{auth.profile.email}</p><div className="inline-badges"><RoleBadge role={auth.profile.role} /><StatusBadge status={auth.profile.account_status} /></div></div></div></section><section className="panel"><h2>Miljøstatus</h2><ul className="status-list"><li><span><Server /> Supabase-miljø</span><strong className={isSupabaseConfigured ? 'status-ok' : 'status-bad'}>{isSupabaseConfigured ? 'Konfigureret' : 'Mangler variabler'}</strong></li><li><span><Database /> Forbindelse</span><strong className={state.data.connected ? 'status-ok' : 'status-bad'}>{state.data.connected ? 'Forbundet' : 'Ingen forbindelse'}</strong></li><li><span><ShieldCheck /> Service role</span><strong className="status-ok">Ikke eksponeret</strong></li></ul><p className="muted">Miljøværdier vises aldrig i admin-appen.</p></section>
    <section className="panel settings-span"><div className="panel__header"><div><h2>Rolleadministration</h2><p>Kun administratorer kan ændre roller. Alle ændringer logges.</p></div></div><div className="staff-list">{state.data.staff.map((staff) => <div key={staff.id} className="staff-row"><Avatar profile={staff} size="small" /><div><strong>{staff.display_name}</strong><span>{staff.email}</span></div><RoleBadge role={staff.role} /><button type="button" className="button button--small button--secondary" onClick={() => setSelected(staff)}>Skift rolle</button></div>)}</div></section>
    <section className="panel"><h2>Moderationsskabeloner</h2><p className="muted">Faste forslag, som sikrer ensartede og konkrete begrundelser.</p><ul className="template-list">{reasonTemplates.map((template) => <li key={template}><CheckCircle2 />{template}</li>)}</ul></section><section className="panel"><h2>Markedspladsens kontakt</h2><a className="support-link" href="mailto:support@equilo.dk"><Mail /><div><strong>support@equilo.dk</strong><span>Primær supportadresse</span></div></a><p className="muted">Domæne: admin.equilo.dk · Produktion via Vercel</p></section></div>{selected && <ActionDialog open onOpenChange={(open) => !open && setSelected(null)} action="change_user_role" targetLabel={selected.display_name} initialRole={selected.role} onConfirm={changeRole} />}</>
}
