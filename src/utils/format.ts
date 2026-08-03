const dateFormatter = new Intl.DateTimeFormat('da-DK', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const currencyFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
})

export const formatDate = (value?: string | null) =>
  value ? dateFormatter.format(new Date(value)) : '—'

export const formatCurrency = (value: number | string) =>
  currencyFormatter.format(Number(value))

export const shortId = (value: string) => value.slice(0, 8).toUpperCase()

export const roleLabel = {
  user: 'Bruger',
  moderator: 'Moderator',
  admin: 'Administrator',
} as const

export const accountStatusLabel = {
  active: 'Aktiv',
  suspended: 'Suspenderet',
  banned: 'Udelukket',
} as const

export const reportStatusLabel = {
  open: 'Åben',
  under_review: 'Under behandling',
  resolved: 'Løst',
  dismissed: 'Afvist',
} as const

export const priorityLabel = {
  low: 'Lav',
  normal: 'Normal',
  high: 'Høj',
  urgent: 'Kritisk',
} as const

export const listingStatusLabel: Record<string, string> = {
  active: 'Aktiv',
  reserved: 'Reserveret',
  sold: 'Solgt',
  archived: 'Arkiveret',
  hidden: 'Skjult',
  removed_by_moderator: 'Fjernet af moderator',
  deleted_by_owner: 'Slettet af ejer',
}

export const actionLabel: Record<string, string> = {
  dismiss_report: 'Afviste anmeldelse',
  mark_under_review: 'Startede behandling',
  hide_image: 'Skjulte billede',
  restore_image: 'Gendannede billede',
  remove_listing: 'Fjernede annonce',
  restore_listing: 'Gendannede annonce',
  warn_user: 'Advarede bruger',
  suspend_user: 'Suspenderede bruger',
  unsuspend_user: 'Ophævede suspendering',
  ban_user: 'Udelukkede bruger',
  change_user_role: 'Ændrede brugerrolle',
  resolve_report: 'Løste anmeldelse',
}
