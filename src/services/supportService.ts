export type SupportCaseStatus = 'new' | 'open' | 'waiting_for_user' | 'resolved' | 'closed'

export interface SupportCase {
  id: string
  subject: string
  status: SupportCaseStatus
  createdAt: string
}

export interface SupportSource {
  configured: boolean
  source: 'email' | 'database'
  contactEmail: string
}

/**
 * Integration boundary for a future ticket provider. The inspected Equilo schema
 * has no support-case table, so this deliberately returns no invented cases.
 */
export async function getSupportSource(): Promise<SupportSource> {
  return { configured: false, source: 'email', contactEmail: 'support@equilo.dk' }
}

export async function getSupportCases(): Promise<SupportCase[]> {
  return []
}
