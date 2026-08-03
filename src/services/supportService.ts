import { supabase } from '../lib/supabase'
import type {
  PaginationResult,
  ReportPriority,
  SupportCase,
  SupportCaseStatus,
  SupportMessage,
} from '../types/database'

const supportCaseSelect = `
  *,
  user:profiles!support_cases_user_id_fkey(id, display_name, avatar_url, location),
  assigned_admin:profiles!support_cases_assigned_admin_id_fkey(id, display_name, avatar_url),
  messages:support_messages(count)
`

const supportCaseDetailSelect = `
  *,
  user:profiles!support_cases_user_id_fkey(id, display_name, avatar_url, location),
  assigned_admin:profiles!support_cases_assigned_admin_id_fkey(id, display_name, avatar_url),
  messages:support_messages(
    *,
    sender:profiles!support_messages_sender_id_fkey(id, display_name, avatar_url)
  ),
  events:support_case_events(
    *,
    actor:profiles!support_case_events_actor_id_fkey(id, display_name, avatar_url)
  )
`

export interface SupportCaseQuery {
  search?: string
  status?: SupportCaseStatus | 'all'
  priority?: ReportPriority | 'all'
  assignedAdminId?: string
  page?: number
  pageSize?: number
}

function hydrateSupportCase(row: SupportCase & { messages?: ({ count: number } | SupportMessage)[] }): SupportCase {
  const countRelation = row.messages?.[0]
  const messageCount = countRelation && 'count' in countRelation ? countRelation.count : row.messages?.length ?? 0
  return {
    ...row,
    message_count: messageCount,
    messages: row.messages?.filter((item): item is SupportMessage => 'id' in item)
      .sort((first, second) => Date.parse(first.created_at) - Date.parse(second.created_at)),
    events: row.events?.sort((first, second) => Date.parse(first.created_at) - Date.parse(second.created_at)),
  }
}

export async function getSupportCases(query: SupportCaseQuery = {}): Promise<PaginationResult<SupportCase>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 25
  let request = supabase
    .from('support_cases')
    .select(supportCaseSelect, { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (query.search) {
    const search = query.search.trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)
    request = isUuid ? request.eq('id', search) : request.ilike('subject', `%${search}%`)
  }
  if (query.status && query.status !== 'all') request = request.eq('status', query.status)
  if (query.priority && query.priority !== 'all') request = request.eq('priority', query.priority)
  if (query.assignedAdminId) request = request.eq('assigned_admin_id', query.assignedAdminId)
  const { data, error, count } = await request
  if (error) throw error
  return {
    data: ((data ?? []) as unknown as (SupportCase & { messages?: { count: number }[] })[]).map(hydrateSupportCase),
    count: count ?? 0,
  }
}

export async function getSupportCaseById(caseId: string): Promise<SupportCase> {
  const { data, error } = await supabase
    .from('support_cases')
    .select(supportCaseDetailSelect)
    .eq('id', caseId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Supportsagen findes ikke.')
  return hydrateSupportCase(data as unknown as SupportCase)
}

export async function replyToSupportCase(input: {
  caseId: string
  message: string
  internal: boolean
  status: SupportCaseStatus
}): Promise<void> {
  const { error } = await supabase.rpc('admin_reply_support_case', {
    p_case_id: input.caseId,
    p_message: input.message.trim(),
    p_internal: input.internal,
    p_status: input.status,
  })
  if (error) throw error
}

export async function updateSupportCase(input: {
  caseId: string
  status?: SupportCaseStatus
  priority?: ReportPriority
  assignedAdminId?: string
  unassign?: boolean
}): Promise<void> {
  const { error } = await supabase.rpc('admin_update_support_case', {
    p_case_id: input.caseId,
    p_status: input.status ?? null,
    p_priority: input.priority ?? null,
    p_assigned_admin_id: input.assignedAdminId ?? null,
    p_unassign: input.unassign ?? false,
  })
  if (error) throw error
}
