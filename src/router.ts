import { useCallback, useSyncExternalStore } from 'react'

function currentPath(): string {
  if (typeof window === 'undefined') {
    return '/'
  }
  const hash = window.location.hash.replace(/^#/, '')
  return hash.startsWith('/') ? hash : '/'
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function navigate(path: string): void {
  window.location.hash = path
  window.scrollTo({ top: 0 })
}

/** Minimal hash based router: keeps the app deployable as static files. */
export function useRoute(): { path: string; segments: string[]; navigate: (path: string) => void } {
  const path = useSyncExternalStore(subscribe, currentPath, currentPath)
  const go = useCallback((next: string) => navigate(next), [])

  return {
    path,
    segments: path.split('/').filter(Boolean),
    navigate: go,
  }
}
