import { useCallback } from "react"
import { useSearchParams } from "react-router-dom"

/** A string state value stored in the URL query string; the default value is omitted from the URL. */
export function useQueryParam(key: string, fallback: string) {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? fallback

  const setValue = useCallback(
    (next: string) => {
      setParams(
        (prev) => {
          const copy = new URLSearchParams(prev)
          if (next && next !== fallback) copy.set(key, next)
          else copy.delete(key)
          return copy
        },
        { replace: true }
      )
    },
    [key, fallback, setParams]
  )

  return [value, setValue] as const
}
