import {
  advanceClaim,
  canTransition,
  createClaim,
  validateClaimInput,
  type ClaimInput,
} from '../domain/claims'
import { cancelPolicy, isRenewable, issuePolicy, renewPolicy } from '../domain/policies'
import { createQuote, quoteStatus } from '../domain/rating'
import { defaultSettings, type PlatformSettings } from '../domain/settings'
import type { ClaimStatus, Policy, QuoteInput } from '../domain/types'
import { renewalPremium } from './selectors'
import type { AppState } from './storage'

export type AppAction =
  | { type: 'quote/created'; id: string; input: QuoteInput; now: string }
  | { type: 'quote/accepted'; id: string; quoteId: string; now: string }
  | { type: 'quote/discarded'; quoteId: string }
  | { type: 'policy/cancelled'; policyId: string; now: string }
  | { type: 'policy/renewed'; policyId: string; now: string }
  | { type: 'claim/created'; id: string; input: ClaimInput; now: string }
  | { type: 'claim/advanced'; claimId: string; status: ClaimStatus; note: string; now: string }
  | { type: 'settings/updated'; settings: PlatformSettings }
  | { type: 'settings/reset' }
  | { type: 'state/reset' }
  | { type: 'state/replaced'; state: AppState }

function isConverted(state: AppState, quoteReference: string): boolean {
  return state.policies.some((policy) => policy.quoteReference === quoteReference)
}

function replacePolicy(state: AppState, current: Policy, next: Policy): AppState {
  return {
    ...state,
    policies: state.policies.map((policy) => (policy === current ? next : policy)),
  }
}

/**
 * Pure reducer for the whole platform. Identifiers and timestamps are supplied
 * by the caller so that the reducer stays deterministic and easy to test.
 * Actions that the platform rules do not allow leave the state unchanged.
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
      const now = new Date(action.now)
      if (
        !quote ||
        isConverted(state, quote.reference) ||
        quoteStatus(quote, state.settings, now) !== 'open'
      ) {
        return state
      }
      const sequence = state.sequences.policy + 1
      const policy = issuePolicy(quote, { id: action.id, sequence, startDate: now })
      return {
        ...state,
        policies: [policy, ...state.policies],
        sequences: { ...state.sequences, policy: sequence },
      }
    }
    case 'quote/discarded': {
      const quote = state.quotes.find((candidate) => candidate.id === action.quoteId)
      // A quote that became a policy is kept as the record of what was bought.
      if (!quote || isConverted(state, quote.reference)) {
        return state
      }
      return { ...state, quotes: state.quotes.filter((candidate) => candidate !== quote) }
    }
    case 'policy/cancelled': {
      const policy = state.policies.find((candidate) => candidate.id === action.policyId)
      if (!policy || policy.status === 'cancelled') {
        return state
      }
      return replacePolicy(state, policy, cancelPolicy(policy, new Date(action.now), state.claims))
    }
    case 'policy/renewed': {
      const policy = state.policies.find((candidate) => candidate.id === action.policyId)
      const now = new Date(action.now)
      if (!policy || !isRenewable(policy, now)) {
        return state
      }
      return replacePolicy(state, policy, renewPolicy(policy, now, renewalPremium(state, policy, now)))
    }
    case 'claim/created': {
      const policy = state.policies.find(
        (candidate) => candidate.policyNumber === action.input.policyNumber,
      )
      const now = new Date(action.now)
      if (!policy || validateClaimInput(action.input, policy, now, state.claims).length > 0) {
        return state
      }
      const sequence = state.sequences.claim + 1
      const claim = createClaim(action.input, policy, { id: action.id, sequence, now })
      return {
        ...state,
        claims: [claim, ...state.claims],
        sequences: { ...state.sequences, claim: sequence },
      }
    }
    case 'claim/advanced': {
      const claim = state.claims.find((candidate) => candidate.id === action.claimId)
      if (!claim || !canTransition(claim.status, action.status)) {
        return state
      }
      const policy = state.policies.find(
        (candidate) => candidate.policyNumber === claim.policyNumber,
      )
      const advanced = advanceClaim(claim, action.status, action.note, new Date(action.now), policy)
      return {
        ...state,
        claims: state.claims.map((candidate) => (candidate === claim ? advanced : candidate)),
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
    case 'state/replaced': {
      return action.state
    }
    default:
      return state
  }
}
