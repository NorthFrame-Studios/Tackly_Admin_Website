import { type Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { getCurrentAdminProfile, signIn as signInService, signOut as signOutService } from '../../services/authService'
import type { AdminProfile } from '../../types/database'
import { AuthContext, type AuthValue } from './authContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    const nextProfile = await getCurrentAdminProfile()
    setProfile(nextProfile)
    setError(null)
  }, [])

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) {
      return
    }
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) {
        try {
          await loadProfile()
        } catch (nextError) {
          setError(getErrorMessage(nextError))
          await supabase.auth.signOut()
          setSession(null)
        }
      }
      if (active) setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) setProfile(null)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    try {
      const nextProfile = await signInService(email, password)
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setProfile(nextProfile)
    } catch (nextError) {
      const message = getErrorMessage(nextError)
      setError(message)
      throw new Error(message, { cause: nextError })
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    await signOutService()
    setSession(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      error,
      isAuthenticated: Boolean(session && profile),
      isAdmin: profile?.role === 'admin',
      hasRole: (roles) => Boolean(profile && roles.includes(profile.role)),
      signIn,
      signOut,
      refreshProfile: loadProfile,
    }),
    [session, profile, loading, error, signIn, signOut, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
