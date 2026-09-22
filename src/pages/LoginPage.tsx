import { Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { getErrorMessage } from '../lib/errors'
import { isSupabaseConfigured } from '../lib/supabase'
import { EquiloMark } from '../layouts/AdminLayout'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!auth.loading && auth.isAuthenticated) return <Navigate to="/" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await auth.signIn(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    } catch (nextError) {
      setError(getErrorMessage(nextError))
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-brand"><EquiloMark /><div><strong>tackly</strong><span>Administration</span></div></div>
        <div className="login-copy"><span className="eyebrow"><LockKeyhole /> Sikker adgang</span><h1 id="login-heading">Velkommen tilbage</h1><p>Log ind med din autoriserede moderator- eller administratorkonto.</p></div>
        {!isSupabaseConfigured && <div className="inline-alert" role="alert">Supabase er ikke konfigureret. Tilføj <code>VITE_SUPABASE_URL</code> og <code>VITE_SUPABASE_ANON_KEY</code>.</div>}
        <form onSubmit={submit} className="form-stack">
          <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="navn@equilo.dk" /></label>
          <label className="field"><span>Adgangskode</span><span className="password-input"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" aria-label={showPassword ? 'Skjul adgangskode' : 'Vis adgangskode'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff /> : <Eye />}</button></span></label>
          {(error || auth.error) && <p className="form-error" role="alert">{error || auth.error}</p>}
          <button type="submit" className="button button--primary button--wide" disabled={auth.loading || !isSupabaseConfigured}>{auth.loading && <LoaderCircle className="spin" />}Log ind</button>
        </form>
        <p className="login-footer">Har du ikke adgang? Kontakt en Tackly-administrator.<br /><Link to="https://tackly.dk">Tilbage til tackly.dk</Link></p>
      </section>
      <aside className="login-art" aria-hidden="true"><div className="login-art__card"><span>Tryg handel</span><strong>Et sikkert marked for hest og rytter.</strong><p>Fælles værktøjer til hurtig, konsekvent og dokumenteret moderation.</p></div></aside>
    </main>
  )
}
