import type {
  Applicant,
  Claim,
  ClaimEvent,
  ClaimStatus,
  Policy,
  PolicyStatus,
  PremiumBreakdown,
  ProductId,
  Quote,
  QuoteInput,
} from '../domain/types'

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

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every(isString)
}

function isProductId(value: unknown): value is ProductId {
  return value === 'auto' || value === 'home' || value === 'life' || value === 'travel'
}

function isPolicyStatus(value: unknown): value is PolicyStatus {
  return value === 'active' || value === 'lapsed' || value === 'cancelled'
}

function isClaimStatus(value: unknown): value is ClaimStatus {
  return (
    value === 'submitted' ||
    value === 'in_review' ||
    value === 'approved' ||
    value === 'declined' ||
    value === 'settled'
  )
}

function isApplicant(value: unknown): value is Applicant {
  return (
    isRecord(value) &&
    isString(value.fullName) &&
    isString(value.email) &&
    isString(value.dateOfBirth) &&
    isString(value.postcode)
  )
}

function isPremiumBreakdown(value: unknown): value is PremiumBreakdown {
  return (
    isRecord(value) &&
    isFiniteNumber(value.base) &&
    isFiniteNumber(value.riskAdjustment) &&
    isFiniteNumber(value.coverageAdditions) &&
    isFiniteNumber(value.excessAdjustment) &&
    isFiniteNumber(value.loyaltyDiscount) &&
    isFiniteNumber(value.netPremium) &&
    isFiniteNumber(value.tax) &&
    isFiniteNumber(value.total) &&
    isFiniteNumber(value.monthly)
  )
}

function isQuoteInput(value: unknown): value is QuoteInput {
  return (
    isRecord(value) &&
    isProductId(value.productId) &&
    isApplicant(value.applicant) &&
    isFiniteNumber(value.sumInsured) &&
    isFiniteNumber(value.excess) &&
    isStringArray(value.coverageIds) &&
    isStringRecord(value.riskAnswers) &&
    isFiniteNumber(value.existingPolicies)
  )
}

function isQuote(value: unknown): value is Quote {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.reference) &&
    isProductId(value.productId) &&
    isString(value.createdAt) &&
    isString(value.expiresAt) &&
    isQuoteInput(value.input) &&
    isPremiumBreakdown(value.premium)
  )
}

function isPolicy(value: unknown): value is Policy {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.policyNumber) &&
    isProductId(value.productId) &&
    isPolicyStatus(value.status) &&
    isApplicant(value.holder) &&
    isFiniteNumber(value.sumInsured) &&
    isFiniteNumber(value.excess) &&
    isStringArray(value.coverageIds) &&
    isPremiumBreakdown(value.premium) &&
    isString(value.startDate) &&
    isString(value.endDate) &&
    isString(value.quoteReference)
  )
}

function isClaimEvent(value: unknown): value is ClaimEvent {
  return (
    isRecord(value) &&
    isClaimStatus(value.status) &&
    isString(value.note) &&
    isString(value.at)
  )
}

function isClaim(value: unknown): value is Claim {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.reference) &&
    isString(value.policyNumber) &&
    isProductId(value.productId) &&
    isString(value.incidentDate) &&
    isString(value.description) &&
    isFiniteNumber(value.amountClaimed) &&
    isClaimStatus(value.status) &&
    isString(value.createdAt) &&
    Array.isArray(value.timeline) &&
    value.timeline.every(isClaimEvent)
  )
}

function validSequence(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
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
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes.filter(isQuote) : [],
      policies: Array.isArray(parsed.policies) ? parsed.policies.filter(isPolicy) : [],
      claims: Array.isArray(parsed.claims) ? parsed.claims.filter(isClaim) : [],
      sequences: {
        quote: validSequence(sequences.quote),
        policy: validSequence(sequences.policy),
        claim: validSequence(sequences.claim),
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
