export function getErrorMessage(error: unknown, fallback = 'Der opstod en uventet fejl.'): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

export function assertData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message)
  return data
}
