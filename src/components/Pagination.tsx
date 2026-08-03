import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, pageSize, count, onChange }: { page: number; pageSize: number; count: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (count <= pageSize) return null
  return (
    <nav className="pagination" aria-label="Sideinddeling">
      <span>Side {page} af {pages} · {count} resultater</span>
      <div>
        <button type="button" className="icon-button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Forrige side"><ChevronLeft /></button>
        <button type="button" className="icon-button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Næste side"><ChevronRight /></button>
      </div>
    </nav>
  )
}
