export type UserRole = 'user' | 'moderator' | 'admin'
export type AccountStatus = 'active' | 'suspended' | 'banned'
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'
export type ReportPriority = 'low' | 'normal' | 'high' | 'urgent'
export type ListingStatus =
  | 'active'
  | 'reserved'
  | 'sold'
  | 'archived'
  | 'hidden'
  | 'removed_by_moderator'
  | 'deleted_by_owner'
export type ListingImageStatus = 'active' | 'hidden' | 'removed'
export type SupportCaseStatus = 'new' | 'open' | 'waiting_for_user' | 'resolved' | 'closed'
export type ModerationActionType =
  | 'dismiss_report'
  | 'mark_under_review'
  | 'hide_image'
  | 'restore_image'
  | 'remove_listing'
  | 'restore_listing'
  | 'warn_user'
  | 'suspend_user'
  | 'unsuspend_user'
  | 'ban_user'
  | 'change_user_role'
  | 'resolve_report'

export interface PublicProfile {
  id: string
  display_name: string
  avatar_url: string | null
  location: string | null
  bio?: string | null
  is_deleted?: boolean
  created_at?: string
}

export interface AdminProfile extends PublicProfile {
  email: string | null
  role: UserRole
  account_status: AccountStatus
  suspension_reason: string | null
  suspended_until: string | null
  moderation_note: string | null
}

export interface AdminUser extends AdminProfile {
  listings_count: number
  reports_received_count: number
  reports_submitted_count: number
  last_activity_at: string | null
}

export interface ListingImage {
  id: string
  listing_id: string
  storage_path: string
  display_order: number
  moderation_status: ListingImageStatus
  cover_position_x?: number
  cover_position_y?: number
  cover_zoom?: number
  created_at: string
  public_url?: string
}

export interface Listing {
  id: string
  seller_id: string
  title: string
  description: string
  category: string
  subcategory: string | null
  size: string | null
  color: string | null
  material: string | null
  condition: string
  status: ListingStatus
  price: number
  accepts_offers: boolean
  reserved_for_user_id: string | null
  location: string
  created_at: string
  updated_at: string
  seller?: PublicProfile | null
  images?: ListingImage[]
  report_count?: number
}

export interface Report {
  id: string
  reporter_id: string
  reported_user_id: string | null
  listing_id: string | null
  listing_image_id: string | null
  message_id: string | null
  conversation_id: string | null
  reason: string
  details: string | null
  status: ReportStatus
  priority: ReportPriority
  assigned_admin_id: string | null
  resolution: string | null
  created_at: string
  reviewed_at: string | null
  resolved_at: string | null
  reporter?: PublicProfile | null
  reported_user?: PublicProfile | null
  assigned_admin?: PublicProfile | null
  listing?: Listing | null
  listing_image?: ListingImage | null
  message?: { id: string; conversation_id: string; sender_id: string; content: string; created_at: string } | null
}

export interface ConversationMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  created_at: string
  read_at: string | null
}

export interface ConversationContext {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
  buyer: PublicProfile | null
  seller: PublicProfile | null
  listing: Pick<Listing, 'id' | 'title' | 'status'> | null
  messages: ConversationMessage[]
}

export interface SupportMessage {
  id: string
  case_id: string
  sender_id: string
  body: string
  is_internal: boolean
  created_at: string
  sender?: PublicProfile | null
}

export interface SupportCaseEvent {
  id: string
  case_id: string
  actor_id: string
  event_type: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: PublicProfile | null
}

export interface SupportCase {
  id: string
  user_id: string
  subject: string
  category: string
  status: SupportCaseStatus
  priority: ReportPriority
  assigned_admin_id: string | null
  created_at: string
  updated_at: string
  last_message_at: string
  resolved_at: string | null
  user?: PublicProfile | null
  assigned_admin?: PublicProfile | null
  messages?: SupportMessage[]
  events?: SupportCaseEvent[]
  message_count?: number
}

export interface ModerationAction {
  id: string
  report_id: string | null
  moderator_id: string
  target_user_id: string | null
  listing_id: string | null
  listing_image_id: string | null
  message_id: string | null
  action: ModerationActionType
  reason: string
  internal_note: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  moderator?: PublicProfile | null
  target_user?: PublicProfile | null
}

export interface DashboardStatistics {
  open_reports: number
  high_priority_reports: number
  under_review_reports: number
  removed_listings: number
  suspended_users: number
  new_users_30d: number
  new_listings_30d: number
  reports_change_7d: number | null
  users_change_30d: number | null
  listings_change_30d: number | null
}

export interface PaginationResult<T> {
  data: T[]
  count: number
}

export interface ModerationActionInput {
  action: ModerationActionType
  reason?: string
  internalNote?: string
  reportId?: string
  targetUserId?: string
  listingId?: string
  listingImageId?: string
  messageId?: string
  suspensionHours?: number
  newRole?: UserRole
}
