import { supabase } from '../lib/supabase'
import type {
  ModerationAction,
  ModerationActionInput,
  ModerationActionType,
  PaginationResult,
} from '../types/database'

const optionalReasonDefaults: Partial<Record<ModerationActionType, string>> = {
  mark_under_review: 'Sagen er taget under behandling.',
  restore_image: 'Billedet er gendannet.',
  restore_listing: 'Annoncen er gendannet.',
  unsuspend_user: 'Suspenderingen er ophævet.',
}

export function requiresModerationReason(action: ModerationActionType): boolean {
  return !optionalReasonDefaults[action]
}

export interface ModerationFilters {
  action?: string
  moderatorId?: string
  targetUserId?: string
  listingId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

const actionSelect = `
  *,
  moderator:profiles!moderation_actions_moderator_id_fkey(id, display_name, avatar_url),
  target_user:profiles!moderation_actions_target_user_id_fkey(id, display_name, avatar_url)
`

export async function getModerationActions(
  filters: ModerationFilters = {},
): Promise<PaginationResult<ModerationAction>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25
  let query = supabase
    .from('moderation_actions')
    .select(actionSelect, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (filters.action) query = query.eq('action', filters.action)
  if (filters.moderatorId) query = query.eq('moderator_id', filters.moderatorId)
  if (filters.targetUserId) query = query.eq('target_user_id', filters.targetUserId)
  if (filters.listingId) query = query.eq('listing_id', filters.listingId)
  if (filters.from) query = query.gte('created_at', filters.from)
  if (filters.to) query = query.lte('created_at', filters.to)

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as ModerationAction[], count: count ?? 0 }
}

export async function performModerationAction(input: ModerationActionInput): Promise<void> {
  const reason = input.reason?.trim() || optionalReasonDefaults[input.action]
  if (!reason || reason.length < 3) {
    throw new Error('Tilføj en begrundelse for handlingen.')
  }
  const { error } = await supabase.rpc('perform_moderation_action', {
    p_action: input.action,
    p_reason: reason,
    p_internal_note: input.internalNote?.trim() || null,
    p_report_id: input.reportId ?? null,
    p_target_user_id: input.targetUserId ?? null,
    p_listing_id: input.listingId ?? null,
    p_listing_image_id: input.listingImageId ?? null,
    p_message_id: input.messageId ?? null,
    p_suspension_hours: input.suspensionHours ?? null,
    p_new_role: input.newRole ?? null,
  })
  if (error) throw error
}
