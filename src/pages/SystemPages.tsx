import { ArrowLeft, LockKeyhole, SearchX } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return <div className="system-page"><LockKeyhole /><h1>Adgang nægtet</h1><p>Din rolle giver ikke adgang til denne side.</p><Link className="button button--primary" to="/"><ArrowLeft /> Tilbage til oversigten</Link></div>
}

export function NotFoundPage() {
  return <div className="system-page"><SearchX /><h1>Siden blev ikke fundet</h1><p>Linket er muligvis forkert, eller siden er flyttet.</p><Link className="button button--primary" to="/"><ArrowLeft /> Tilbage til oversigten</Link></div>
}
