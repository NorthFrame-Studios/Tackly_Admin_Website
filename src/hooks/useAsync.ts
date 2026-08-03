import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../lib/errors'

export function useAsync<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loaderRef = useRef(loader)
  const dependencyKey = JSON.stringify(dependencies)
  const latestKeyRef = useRef(dependencyKey)
  useLayoutEffect(() => {
    loaderRef.current = loader
    latestKeyRef.current = dependencyKey
  })

  const run = useCallback(async (requestKey: string) => {
    setLoading(true)
    setError(null)
    try {
      const nextData = await loaderRef.current()
      if (latestKeyRef.current === requestKey) setData(nextData)
    } catch (nextError) {
      if (latestKeyRef.current === requestKey) setError(getErrorMessage(nextError))
    } finally {
      if (latestKeyRef.current === requestKey) setLoading(false)
    }
  }, [])

  const reload = useCallback(() => run(dependencyKey), [dependencyKey, run])

  useEffect(() => {
    queueMicrotask(() => void reload())
  }, [reload])

  return { data, loading, error, reload, setData }
}
