import * as Dialog from '@radix-ui/react-dialog'
import { LoaderCircle, X } from 'lucide-react'
import { useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { requiresModerationReason } from '../services/moderationService'
import type { ModerationActionInput, ModerationActionType, UserRole } from '../types/database'
import { actionLabel } from '../utils/format'

const destructiveActions = new Set<ModerationActionType>([
  'remove_listing', 'hide_image', 'suspend_user', 'ban_user', 'change_user_role',
])

interface ActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: ModerationActionType
  targetLabel?: string
  initialRole?: UserRole
  onConfirm: (values: Pick<ModerationActionInput, 'reason' | 'internalNote' | 'suspensionHours' | 'newRole'>) => Promise<void>
}

export function ActionDialog({ open, onOpenChange, action, targetLabel, initialRole, onConfirm }: ActionDialogProps) {
  const [reason, setReason] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [duration, setDuration] = useState(168)
  const [newRole, setNewRole] = useState<UserRole>(initialRole ?? 'user')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const destructive = destructiveActions.has(action)
  const reasonRequired = requiresModerationReason(action)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReason('')
      setInternalNote('')
      setNewRole(initialRole ?? 'user')
      setConfirmed(false)
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if ((reasonRequired && reason.trim().length < 3) || (destructive && !confirmed)) return
    setSubmitting(true)
    setError(null)
    try {
      await onConfirm({
        reason: reason.trim(),
        internalNote: internalNote.trim(),
        suspensionHours: action === 'suspend_user' ? duration : undefined,
        newRole: action === 'change_user_role' ? newRole : undefined,
      })
      handleOpenChange(false)
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Handlingen kunne ikke gennemføres.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby="action-description">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Bekræft handling</Dialog.Title>
              <Dialog.Description id="action-description">
                {actionLabel[action] ?? action}{targetLabel ? ` · ${targetLabel}` : ''}
              </Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Luk"><X /></Dialog.Close>
          </div>
          <form onSubmit={submit} className="form-stack">
            <label className="field">
              <span>Begrundelse {reasonRequired ? <em>påkrævet</em> : <small>valgfri</small>}</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={reasonRequired ? 3 : undefined} maxLength={1000} required={reasonRequired} rows={4} autoFocus placeholder={reasonRequired ? 'Beskriv den konkrete årsag…' : 'Tilføj eventuelt en forklaring…'} />
            </label>
            <label className="field">
              <span>Intern note <small>valgfri</small></span>
              <textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} maxLength={2000} rows={3} placeholder="Kun synlig for moderatorer og administratorer" />
            </label>
            {action === 'suspend_user' && (
              <label className="field"><span>Varighed</span><select value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={24}>24 timer</option><option value={72}>3 dage</option><option value={168}>7 dage</option><option value={720}>30 dage</option></select></label>
            )}
            {action === 'change_user_role' && (
              <label className="field"><span>Ny rolle</span><select value={newRole} onChange={(event) => setNewRole(event.target.value as UserRole)}><option value="user">Bruger</option><option value="moderator">Moderator</option><option value="admin">Administrator</option></select></label>
            )}
            {destructive && (
              <label className="confirm-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Jeg har gennemgået sagen og bekræfter handlingen.</span></label>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <Dialog.Close type="button" className="button button--secondary">Annuller</Dialog.Close>
              <button type="submit" className={`button ${destructive ? 'button--danger' : 'button--primary'}`} disabled={submitting || (reasonRequired && reason.trim().length < 3) || (destructive && !confirmed)}>
                {submitting && <LoaderCircle className="spin" size={17} />}
                Bekræft handling
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ConfirmDialog({ open, title, description, confirmLabel, onOpenChange, onConfirm }: { open: boolean; title: string; description: string; confirmLabel: string; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content"><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description><div className="dialog-actions"><Dialog.Close className="button button--secondary">Annuller</Dialog.Close><button type="button" className="button button--danger" onClick={onConfirm}>{confirmLabel}</button></div></Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  )
}
