import type { AuthError } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { AdminProfile } from '../types/database'
import type { UserRole } from '../types/database'

export const isStaffRole = (role: UserRole): boolean =>
  role === 'moderator' || role === 'admin'

export async function signIn(email: string, password: string): Promise<AdminProfile> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase er ikke konfigureret. Tilføj miljøvariablerne og genstart appen.')
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw translateAuthError(error)
  try {
    return await getCurrentAdminProfile()
  } catch (error) {
    await supabase.auth.signOut()
    throw error
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentAdminProfile(): Promise<AdminProfile> {
  const { data, error } = await supabase.rpc('get_my_admin_profile')
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      throw new Error('Admin-databasemigrationen er ikke installeret endnu.')
    }
    throw error
  }
  const profile = Array.isArray(data) ? data[0] : data
  if (!profile || !isStaffRole(profile.role)) {
    throw new Error('Du har ikke adgang til Tackly Admin.')
  }
  if (profile.account_status !== 'active') {
    throw new Error('Din administratorkonto er ikke aktiv.')
  }
  return profile as AdminProfile
}

function translateAuthError(error: AuthError): Error {
  if (error.status === 400) return new Error('E-mail eller adgangskode er forkert.')
  if (error.status === 429) return new Error('For mange loginforsøg. Prøv igen om lidt.')
  return new Error('Login mislykkedes. Kontrollér forbindelsen og prøv igen.')
}
