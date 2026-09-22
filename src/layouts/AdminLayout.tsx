import {
  BarChart3, ChevronRight, ClipboardList, FileText, Headphones, LogOut,
  Menu, Search, Settings, ShieldCheck, Users, X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/authContext'
import { roleLabel } from '../utils/format'
import { Avatar } from '../components/Cards'

const navItems = [
  { to: '/', label: 'Oversigt', icon: BarChart3 },
  { to: '/reports', label: 'Anmeldelser', icon: ClipboardList },
  { to: '/listings', label: 'Annoncer', icon: FileText },
  { to: '/users', label: 'Brugere', icon: Users },
  { to: '/moderation-log', label: 'Moderationslog', icon: ShieldCheck },
  { to: '/support', label: 'Support', icon: Headphones },
] as const

const pageNames: Record<string, string> = {
  reports: 'Anmeldelser', listings: 'Annoncer', users: 'Brugere',
  'moderation-log': 'Moderationslog', support: 'Support', settings: 'Indstillinger',
}

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { profile, isAdmin, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const segments = location.pathname.split('/').filter(Boolean)

  async function logout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (!profile) return null

  return (
    <div className="admin-shell">
      {mobileOpen && <button type="button" className="sidebar-scrim" aria-label="Luk menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand"><Link to="/" onClick={() => setMobileOpen(false)}><EquiloMark /><div><strong>tackly</strong><span>Administration</span></div></Link><button type="button" className="icon-button sidebar__close" aria-label="Luk menu" onClick={() => setMobileOpen(false)}><X /></button></div>
        <nav aria-label="Primær navigation">
          {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobileOpen(false)}><Icon aria-hidden="true" /><span>{label}</span></NavLink>)}
          {isAdmin && <NavLink to="/settings" onClick={() => setMobileOpen(false)}><Settings aria-hidden="true" /><span>Indstillinger</span></NavLink>}
        </nav>
        <div className="sidebar__footer"><div className="sidebar-user"><Avatar profile={profile} size="small" /><div><strong>{profile.display_name}</strong><span>{roleLabel[profile.role]}</span></div></div><button type="button" onClick={() => void logout()}><LogOut /><span>Log ud</span></button></div>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <button type="button" className="icon-button menu-button" aria-label="Åbn menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu /></button>
          <nav className="breadcrumbs" aria-label="Brødkrummer"><Link to="/">Tackly Admin</Link>{segments.map((segment, index) => <span key={`${segment}-${index}`}><ChevronRight />{index === 0 && pageNames[segment] ? pageNames[segment] : index === 1 ? 'Detaljer' : segment}</span>)}</nav>
          <Link to="/users" className="topbar-search"><Search /><span>Søg brugere og annoncer</span><kbd>⌘ K</kbd></Link>
          <div className="topbar-user"><Avatar profile={profile} size="small" /><div><strong>{profile.display_name}</strong><span>{roleLabel[profile.role]}</span></div></div>
        </header>
        <main className="content" id="main-content"><Outlet /></main>
      </div>
    </div>
  )
}

export function EquiloMark() {
  return <span className="equilo-mark" aria-hidden="true"><span /></span>
}
