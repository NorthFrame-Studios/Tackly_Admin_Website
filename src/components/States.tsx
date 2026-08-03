import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'

export function LoadingState({ label = 'Indlæser…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <div className={`state ${fullPage ? 'state--full' : ''}`} role="status">
      <LoaderCircle className="spin" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div><h3>Noget gik galt</h3><p>{message}</p></div>
      {onRetry && <button type="button" className="button button--secondary" onClick={onRetry}><RefreshCw size={16} /> Prøv igen</button>}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="state state--empty">
      <Inbox aria-hidden="true" />
      <div><h3>{title}</h3><p>{description}</p></div>
      {action}
    </div>
  )
}
