import { getListingImageUrl, supabase } from '../lib/supabase'
import type {
  PaginationResult,
  Report,
  ListingImage,
  ReportPriority,
  ReportStatus,
  ConversationContext,
} from '../types/database'

const reportSelect = `
  *,
  reporter:profiles!reports_reporter_id_fkey(id, display_name, avatar_url, location),
  reported_user:profiles!reports_reported_user_id_fkey(id, display_name, avatar_url, location),
  assigned_admin:profiles!reports_assigned_admin_id_fkey(id, display_name, avatar_url),
  listing:listings!reports_listing_id_fkey(
    *,
    seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, location),
    images:listing_images(*)
  ),
  listing_image:listing_images!reports_listing_image_id_fkey(*),
  message:messages!reports_message_id_fkey(id, conversation_id, sender_id, content, created_at)
`

export interface ReportQuery {
  status?: ReportStatus | 'all'
  priority?: ReportPriority | 'all'
  assignedAdminId?: string
  reason?: string
  from?: string
  to?: string
  listingId?: string
  reportedUserId?: string
  reporterId?: string
  sort?: 'newest' | 'oldest' | 'priority' | 'status'
  page?: number
  pageSize?: number
}

function hydrateReport(report: Report): Report {
  const addUrls = (images: ListingImage[] = []) =>
    images.map((image) => ({ ...image, public_url: getListingImageUrl(image.storage_path) }))
  return {
    ...report,
    listing: report.listing
      ? { ...report.listing, images: addUrls(report.listing.images) }
      : report.listing,
    listing_image: report.listing_image
      ? {
          ...report.listing_image,
          public_url: getListingImageUrl(report.listing_image.storage_path),
        }
      : report.listing_image,
  }
}

export async function getReports(query: ReportQuery = {}): Promise<PaginationResult<Report>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 25
  let request = supabase
    .from('reports')
    .select(reportSelect, { count: 'exact' })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (query.status && query.status !== 'all') request = request.eq('status', query.status)
  if (query.priority && query.priority !== 'all') request = request.eq('priority', query.priority)
  if (query.assignedAdminId) request = request.eq('assigned_admin_id', query.assignedAdminId)
  if (query.reason) request = request.ilike('reason', `%${query.reason}%`)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)
  if (query.listingId) request = request.eq('listing_id', query.listingId)
  if (query.reportedUserId) request = request.eq('reported_user_id', query.reportedUserId)
  if (query.reporterId) request = request.eq('reporter_id', query.reporterId)

  if (query.sort === 'oldest') request = request.order('created_at', { ascending: true })
  else if (query.sort === 'priority') request = request.order('priority_rank', { ascending: false })
  else if (query.sort === 'status') request = request.order('status').order('created_at', { ascending: false })
  else request = request.order('created_at', { ascending: false })

  const { data, error, count } = await request
  if (error) throw error
  return {
    data: ((data ?? []) as unknown as Report[]).map(hydrateReport),
    count: count ?? 0,
  }
}

export async function getReportById(reportId: string): Promise<Report> {
  const { data, error } = await supabase
    .from('reports')
    .select(reportSelect)
    .eq('id', reportId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Anmeldelsen findes ikke.')
  return hydrateReport(data as unknown as Report)
}

export async function getReportConversation(report: Report): Promise<ConversationContext | null> {
  const conversationId = report.conversation_id ?? report.message?.conversation_id
  if (!conversationId) return null

  const [conversationResult, messagesResult] = await Promise.all([
    supabase
      .from('conversations')
      .select(`
        id, listing_id, buyer_id, seller_id, created_at, updated_at,
        buyer:profiles!conversations_buyer_id_fkey(id, display_name, avatar_url, location),
        seller:profiles!conversations_seller_id_fkey(id, display_name, avatar_url, location),
        listing:listings!conversations_listing_id_fkey(id, title, status)
      `)
      .eq('id', conversationId)
      .maybeSingle(),
    supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, message_type, created_at, read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
  ])
  if (conversationResult.error) throw conversationResult.error
  if (messagesResult.error) throw messagesResult.error
  if (!conversationResult.data) return null
  return {
    ...(conversationResult.data as unknown as Omit<ConversationContext, 'messages'>),
    messages: (messagesResult.data ?? []) as ConversationContext['messages'],
  }
}

export async function getRelatedReports(userId: string, excludeId?: string): Promise<Report[]> {
  let query = supabase
    .from('reports')
    .select(reportSelect)
    .eq('reported_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(8)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as Report[]).map(hydrateReport)
}

export async function getReportsAgainstUser(userId: string, limit = 10): Promise<Report[]> {
  const { data: listings, error: listingError } = await supabase
    .from('listings')
    .select('id')
    .eq('seller_id', userId)
  if (listingError) throw listingError

  const directPromise = getReports({ reportedUserId: userId, pageSize: limit })
  const listingIds = (listings ?? []).map((listing) => listing.id)
  const listingPromise = listingIds.length
    ? supabase
        .from('reports')
        .select(reportSelect)
        .in('listing_id', listingIds)
        .order('created_at', { ascending: false })
        .limit(limit)
    : Promise.resolve({ data: [], error: null })
  const [direct, listingResult] = await Promise.all([directPromise, listingPromise])
  if (listingResult.error) throw listingResult.error

  const unique = new Map<string, Report>()
  for (const report of [...direct.data, ...((listingResult.data ?? []) as unknown as Report[])]) {
    unique.set(report.id, hydrateReport(report))
  }
  return [...unique.values()]
    .sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
    .slice(0, limit)
}
