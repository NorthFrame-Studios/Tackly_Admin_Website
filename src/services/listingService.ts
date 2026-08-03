import { getListingImageUrl, supabase } from '../lib/supabase'
import type { Listing, PaginationResult } from '../types/database'

const listingSelect = `
  *,
  seller:profiles!listings_seller_id_fkey(id, display_name, avatar_url, location, created_at),
  images:listing_images(*),
  reports:reports(count)
`

export interface ListingQuery {
  search?: string
  status?: string
  category?: string
  sellerId?: string
  reportedOnly?: boolean
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

function hydrateListing(row: Listing & { reports?: { count: number }[] }): Listing {
  return {
    ...row,
    price: Number(row.price),
    images: (row.images ?? [])
      .map((image) => ({ ...image, public_url: getListingImageUrl(image.storage_path) }))
      .sort((a, b) => a.display_order - b.display_order),
    report_count: row.reports?.[0]?.count ?? row.report_count ?? 0,
  }
}

export async function getListings(query: ListingQuery = {}): Promise<PaginationResult<Listing>> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 25
  const selectedColumns = query.reportedOnly
    ? listingSelect.replace('reports:reports(count)', 'reports:reports!inner(count)')
    : listingSelect
  let request = supabase
    .from('listings')
    .select(selectedColumns, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (query.search) request = request.or(`title.ilike.%${query.search}%,description.ilike.%${query.search}%`)
  if (query.status) request = request.eq('status', query.status)
  if (query.category) request = request.eq('category', query.category)
  if (query.sellerId) request = request.eq('seller_id', query.sellerId)
  if (query.from) request = request.gte('created_at', query.from)
  if (query.to) request = request.lte('created_at', query.to)
  const { data, error, count } = await request
  if (error) throw error
  return {
    data: ((data ?? []) as unknown as (Listing & { reports?: { count: number }[] })[]).map(hydrateListing),
    count: count ?? 0,
  }
}

export async function getListingById(id: string): Promise<Listing> {
  const { data, error } = await supabase.from('listings').select(listingSelect).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Annoncen findes ikke.')
  return hydrateListing(data as unknown as Listing & { reports?: { count: number }[] })
}
