import { supabase } from '../lib/supabase'
import type { AccountStatus, AdminUser, PaginationResult, UserRole } from '../types/database'

export interface UserQuery {
  search?: string
  role?: UserRole | 'all'
  accountStatus?: AccountStatus | 'all'
  reportedOnly?: boolean
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export async function getUsers(query: UserQuery = {}): Promise<PaginationResult<AdminUser>> {
  const { data, error } = await supabase.rpc('admin_get_users', {
    p_search: query.search?.trim() || null,
    p_role: query.role && query.role !== 'all' ? query.role : null,
    p_account_status:
      query.accountStatus && query.accountStatus !== 'all' ? query.accountStatus : null,
    p_reported_only: query.reportedOnly ?? false,
    p_from: query.from || null,
    p_to: query.to || null,
    p_offset: ((query.page ?? 1) - 1) * (query.pageSize ?? 25),
    p_limit: query.pageSize ?? 25,
  })
  if (error) throw error
  const rows = (data ?? []) as (AdminUser & { total_count?: number })[]
  return { data: rows, count: rows[0]?.total_count ?? rows.length }
}

export async function getUserById(userId: string): Promise<AdminUser> {
  const { data, error } = await supabase.rpc('admin_get_user_by_id', { p_user_id: userId })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Brugeren findes ikke.')
  return row as AdminUser
}
