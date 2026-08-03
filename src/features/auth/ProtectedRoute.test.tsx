import { render, screen } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AdminProfile, UserRole } from '../../types/database'
import { AuthContext } from './authContext'
import { ProtectedRoute, RoleProtectedRoute } from './ProtectedRoute'

function authValue(role: UserRole | null) {
  const profile: AdminProfile | null = role ? {
    id: 'user-1', display_name: 'Testbruger', avatar_url: null, location: null,
    email: role === 'user' ? 'admin@equilo.dk' : 'person@example.dk', role,
    account_status: 'active', suspension_reason: null, suspended_until: null,
    moderation_note: null,
  } : null
  return {
    session: role ? ({ user: { id: 'user-1' } } as Session) : null,
    profile,
    loading: false,
    error: null,
    isAuthenticated: Boolean(role),
    isAdmin: role === 'admin',
    hasRole: (roles: UserRole[]) => Boolean(role && roles.includes(role)),
    signIn: vi.fn(), signOut: vi.fn(), refreshProfile: vi.fn(),
  }
}

function renderProtected(role: UserRole | null, adminOnly = false) {
  render(<AuthContext.Provider value={authValue(role)}><MemoryRouter initialEntries={['/secure']}><Routes><Route path="/login" element={<div>Login</div>} /><Route path="/forbidden" element={<div>Ingen adgang</div>} /><Route element={<ProtectedRoute />}>{adminOnly ? <Route element={<RoleProtectedRoute adminOnly />}><Route path="/secure" element={<div>Sikkert indhold</div>} /></Route> : <Route path="/secure" element={<div>Sikkert indhold</div>} />}</Route></Routes></MemoryRouter></AuthContext.Provider>)
}

describe('rollebeskyttede routes', () => {
  it('sender brugere uden session til login', () => { renderProtected(null); expect(screen.getByText('Login')).toBeInTheDocument() })
  it('afviser en normal bruger, selv med admin-e-mail', () => { renderProtected('user'); expect(screen.getByText('Login')).toBeInTheDocument() })
  it('giver moderator adgang til admin-dashboardet', () => { renderProtected('moderator'); expect(screen.getByText('Sikkert indhold')).toBeInTheDocument() })
  it('afviser moderator på administratorruter', () => { renderProtected('moderator', true); expect(screen.getByText('Ingen adgang')).toBeInTheDocument() })
  it('giver administrator adgang til administratorruter', () => { renderProtected('admin', true); expect(screen.getByText('Sikkert indhold')).toBeInTheDocument() })
})
