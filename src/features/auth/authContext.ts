import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { AdminProfile, UserRole } from '../../types/database'

export interface AuthValue {
  session: Session | null
  profile: AdminProfile | null
  loading: boolean
  error: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  hasRole: (roles: UserRole[]) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth skal bruges inden i AuthProvider.')
  return value
}
