import type { Claim, Policy, Quote } from '../domain/types'

export interface AppState {
  quotes: Quote[]
  policies: Policy[]
  claims: Claim[]
  sequences: {
    quote: number
    policy: number
    claim: number
  }
}

export const emptyState: AppState = {
  quotes: [],
  policies: [],
  claims: [],
  sequences: { quote: 0, policy: 0, claim: 0 },
}

export const STORAGE_KEY = 'advantage.state.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Reads persisted state, falling back to an empty state when it is missing or corrupt. */
export function loadState(storage: Storage | undefined = safeStorage()): AppState {
  if (!storage) {
    return emptyState
  }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      return emptyState
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return emptyState
    }
    const sequences = isRecord(parsed.sequences) ? parsed.sequences : {}
    return {
      quotes: Array.isArray(parsed.quotes) ? (parsed.quotes as Quote[]) : [],
      policies: Array.isArray(parsed.policies) ? (parsed.policies as Policy[]) : [],
      claims: Array.isArray(parsed.claims) ? (parsed.claims as Claim[]) : [],
      sequences: {
        quote: typeof sequences.quote === 'number' ? sequences.quote : 0,
        policy: typeof sequences.policy === 'number' ? sequences.policy : 0,
        claim: typeof sequences.claim === 'number' ? sequences.claim : 0,
      },
    }
  } catch {
    return emptyState
  }
}

export function saveState(state: AppState, storage: Storage | undefined = safeStorage()): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode, quota); the app still works in memory.
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}
