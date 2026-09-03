import { useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { AppContext } from './AppContext'
import { appReducer } from './appReducer'
import { loadState, saveState } from './storage'

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => loadState())

  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
