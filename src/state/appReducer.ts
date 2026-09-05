import { advanceClaim, createClaim, type ClaimInput } from '../domain/claims'
import { cancelPolicy, issuePolicy, renewPolicy } from '../domain/policies'
import { createQuote } from '../domain/rating'
import { defaultSettings, type PlatformSettings } from '../domain/settings'
import type { ClaimStatus, QuoteInput } from '../domain/types'
import type { AppState } from './storage'

export type AppAction =
  | { type: 'quote/created'; id: string; input: QuoteInput; now: string }
  | { type: 'quote/accepted'; id: string; quoteId: string; now: string }
  | { type: 'policy/cancelled'; policyId: string }
  | { type: 'policy/renewed'; policyId: string; now: string }
  | { type: 'claim/created'; id: string; input: ClaimInput; now: string }
  | { type: 'claim/advanced'; claimId: string; status: ClaimStatus; note: string; now: string }
  | { type: 'settings/updated'; settings: PlatformSettings }
  | { type: 'settings/reset' }
  | { type: 'state/reset' }

/**
 * Pure reducer for the whole platform. Identifiers and timestamps are supplied
 * by the caller so that the reducer stays deterministic and easy to test.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'quote/created': {
      const sequence = state.sequences.quote + 1
      const quote = createQuote(action.input, {
        id: action.id,
        sequence,
        now: new Date(action.now),
        settings: state.settings,
      })
      return {
        ...state,
        quotes: [quote, ...state.quotes],
        sequences: { ...state.sequences, quote: sequence },
      }
    }
    case 'quote/accepted': {
      const quote = state.quotes.find((candidate) => candidate.id === action.quoteId)
      if (!quote || state.policies.some((policy) => policy.quoteReference === quote.reference)) {
        return state
      }
      const sequence = state.sequences.policy + 1
      const policy = issuePolicy(quote, {
        id: action.id,
        sequence,
        startDate: new Date(action.now),
      })
      return {
        ...state,
        policies: [policy, ...state.policies],
        sequences: { ...state.sequences, policy: sequence },
      }
    }
    case 'policy/cancelled': {
      return {
        ...state,
        policies: state.policies.map((policy) =>
          policy.id === action.policyId ? cancelPolicy(policy) : policy,
        ),
      }
    }
    case 'policy/renewed': {
      return {
        ...state,
        policies: state.policies.map((policy) =>
          policy.id === action.policyId ? renewPolicy(policy, new Date(action.now)) : policy,
        ),
      }
    }
    case 'claim/created': {
      const policy = state.policies.find(
        (candidate) => candidate.policyNumber === action.input.policyNumber,
      )
      if (!policy) {
        return state
      }
      const sequence = state.sequences.claim + 1
      const claim = createClaim(action.input, policy, {
        id: action.id,
        sequence,
        now: new Date(action.now),
      })
      return {
        ...state,
        claims: [claim, ...state.claims],
        sequences: { ...state.sequences, claim: sequence },
      }
    }
    case 'claim/advanced': {
      return {
        ...state,
        claims: state.claims.map((claim) =>
          claim.id === action.claimId
            ? advanceClaim(claim, action.status, action.note, new Date(action.now))
            : claim,
        ),
      }
    }
    case 'settings/updated': {
      return { ...state, settings: action.settings }
    }
    case 'settings/reset': {
      return { ...state, settings: defaultSettings }
    }
    case 'state/reset': {
      return {
        settings: state.settings,
        quotes: [],
        policies: [],
        claims: [],
        sequences: { quote: 0, policy: 0, claim: 0 },
      }
    }
    default:
      return state
  }
}
