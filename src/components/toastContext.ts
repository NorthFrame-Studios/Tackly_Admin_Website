import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error'
export interface ToastValue { showToast: (message: string, type?: ToastType) => void }

export const ToastContext = createContext<ToastValue | null>(null)

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast skal bruges inden i ToastProvider.')
  return value
}
