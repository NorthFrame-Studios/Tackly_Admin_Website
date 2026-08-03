import { ExternalLink, Headphones, Mail, MessageSquareText } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { PageHeader } from '../components/PageHeader'
import { useAsync } from '../hooks/useAsync'
import { getSupportCases, getSupportSource } from '../services/supportService'

export function SupportPage() {
  const state = useAsync(async () => {
    const [source, cases] = await Promise.all([getSupportSource(), getSupportCases()])
    return { source, cases }
  }, [])
  if (state.loading) return <LoadingState label="Henter supportstatus…" />
  if (state.error || !state.data) return <ErrorState message={state.error ?? 'Supportstatus kunne ikke hentes.'} onRetry={() => void state.reload()} />
  const email = state.data.source.contactEmail
  return <><PageHeader title="Support" description="Saml support- og moderationsarbejde ét sted." actions={<a className="button button--secondary" href={`mailto:${email}`}><Mail /> Skriv til support</a>} /><div className="dashboard-grid"><section className="panel"><div className="panel__header"><div><span className="eyebrow"><Headphones /> Supporthenvendelser</span><h2>Ingen ticketsystem er tilsluttet</h2><p>Den eksisterende Equilo-app åbner brugerens e-mailklient og sender henvendelser til {email}. Der findes derfor ingen supporttabel at vise endnu.</p></div></div><EmptyState title="Klar til en fremtidig integration" description="Dataservicelaget kan kobles til et ticketsystem med statuserne Ny, Åben, Afventer bruger, Løst og Lukket, når en datakilde er valgt." /></section><aside className="stack"><section className="panel"><h2>Nuværende arbejdsgang</h2><ol className="numbered-list"><li><span><MessageSquareText /></span><div><strong>Modtag via e-mail</strong><p>Henvendelser lander på {email}.</p></div></li><li><span><Headphones /></span><div><strong>Behandl i supportindbakken</strong><p>Ingen sager kopieres eller opdigtets i admin-appen.</p></div></li></ol></section><section className="panel"><h2>Kontakt</h2><a className="support-link" href={`mailto:${email}`}><Mail /><div><strong>{email}</strong><span>Åbn i din e-mailklient</span></div><ExternalLink /></a></section></aside></div></>
}
