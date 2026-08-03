import { EyeOff, RotateCcw } from 'lucide-react'
import type { ListingImage } from '../types/database'
import { StatusBadge } from './Badges'

export function ImageGallery({ images, onAction, readOnly = false }: { images: ListingImage[]; onAction?: (image: ListingImage, action: 'hide_image' | 'restore_image') => void; readOnly?: boolean }) {
  if (!images.length) return <p className="muted">Annoncen har ingen billeder.</p>
  return <div className="image-gallery">{images.map((image, index) => <figure key={image.id}><img src={image.public_url} alt={`Annoncebillede ${index + 1}`} /><figcaption><StatusBadge status={image.moderation_status} />{!readOnly && onAction && (image.moderation_status === 'active' ? <button type="button" className="button button--small button--secondary" onClick={() => onAction(image, 'hide_image')}><EyeOff /> Skjul</button> : <button type="button" className="button button--small button--secondary" onClick={() => onAction(image, 'restore_image')}><RotateCcw /> Gendan</button>)}</figcaption></figure>)}</div>
}
