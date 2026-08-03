import { supabase } from '../lib/supabase'
import type { DashboardStatistics } from '../types/database'

export async function getDashboardStatistics(): Promise<DashboardStatistics> {
  const { data, error } = await supabase.rpc('admin_dashboard_statistics')
  if (error) throw error
  return data as DashboardStatistics
}
