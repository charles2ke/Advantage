import { createContext, useContext, type Dispatch } from 'react'
import type { AppAction } from './appReducer'
import { emptyState, type AppState } from './storage'

export interface AppContextValue {
  state: AppState
  dispatch: Dispatch<AppAction>
}

export const AppContext = createContext<AppContextValue>({
  state: emptyState,
  dispatch: () => undefined,
})

export function useApp(): AppContextValue {
  return useContext(AppContext)
}

/** Generates an identifier, falling back to a random string where crypto is unavailable. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}
