import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || import.meta.env.EXPO_PUBLIC_SUPABASE_URL
)?.trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.supabase.co',
  supabaseAnonKey || 'configuration-required',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export function getListingImageUrl(storagePath: string): string {
  return supabase.storage.from('listing-images').getPublicUrl(storagePath).data.publicUrl
}
