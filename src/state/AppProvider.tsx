import { useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { AppContext } from './AppContext'
import { appReducer } from './appReducer'
import { loadState, saveState, STORAGE_KEY, type AppState } from './storage'

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => loadState())
  // State read from storage after another tab saved it does not need saving again.
  const stateFromStorage = useRef<AppState | null>(null)

  useEffect(() => {
    if (state !== stateFromStorage.current) {
      saveState(state)
    }
  }, [state])

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // A null key means another tab cleared all of the site's storage.
      if (event.key === null || event.key === STORAGE_KEY) {
        const next = loadState()
        stateFromStorage.current = next
        dispatch({ type: 'state/replaced', state: next })
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
