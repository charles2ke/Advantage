import { integrationCatalog } from '../integrations/catalog'
import { isSupportedBaseUrl } from '../integrations/http'
import {
  defaultSettings,
  isRate,
  MAX_QUOTE_VALIDITY_DAYS,
  MIN_QUOTE_VALIDITY_DAYS,
  type IntegrationSettings,
  type PlatformSettings,
} from '../domain/settings'
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
  settings: PlatformSettings
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
  settings: defaultSettings,
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

function coerceSupportEmail(value: unknown): string {
  if (!isString(value)) {
    return defaultSettings.supportEmail
  }
  const email = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : defaultSettings.supportEmail
}

function isRateValue(value: unknown): value is number {
  return isFiniteNumber(value) && isRate(value)
}

function isQuoteValidityDays(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    Number.isInteger(value) &&
    value >= MIN_QUOTE_VALIDITY_DAYS &&
    value <= MAX_QUOTE_VALIDITY_DAYS
  )
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

const policyStatuses: Record<PolicyStatus, true> = {
  active: true,
  lapsed: true,
  cancelled: true,
}

function isPolicyStatus(value: unknown): value is PolicyStatus {
  return isString(value) && value in policyStatuses
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

function isClaimEvent(value: unknown): value is ClaimEvent {
  return (
    isRecord(value) &&
    isClaimStatus(value.status) &&
    isString(value.note) &&
    isString(value.at)
  )
}

function isOptional<T>(value: unknown, guard: (candidate: unknown) => candidate is T): boolean {
  return value === undefined || guard(value)
}

/** A policy as persisted: policies saved before risk answers were kept on them have none. */
type StoredPolicy = Omit<Policy, 'riskAnswers'> & { riskAnswers?: Record<string, string> }

function isStoredPolicy(value: unknown): value is StoredPolicy {
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
    isOptional(value.riskAnswers, isStringRecord) &&
    isPremiumBreakdown(value.premium) &&
    isString(value.startDate) &&
    isString(value.endDate) &&
    isString(value.quoteReference) &&
    isOptional(value.cancelledAt, isString) &&
    isOptional(value.refund, isFiniteNumber)
  )
}

/** Fills in missing risk answers from the quote the policy was bought from. */
function withRiskAnswers(policy: StoredPolicy, quotes: Quote[]): Policy {
  const riskAnswers =
    policy.riskAnswers ??
    quotes.find((quote) => quote.reference === policy.quoteReference)?.input.riskAnswers ??
    {}
  return { ...policy, riskAnswers }
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
    value.timeline.every(isClaimEvent) &&
    isOptional(value.settledAmount, isFiniteNumber)
  )
}

/** Reads settings from persisted state, falling back per field to the defaults. */
export function coerceSettings(value: unknown): PlatformSettings {
  if (!isRecord(value)) {
    return defaultSettings
  }
  // An empty or unrecognised list would leave nothing on sale, so fall back to
  // the full catalogue; the admin portal never saves an empty selection.
  const enabled = isStringArray(value.enabledProducts)
    ? value.enabledProducts.filter(isProductId)
    : []

  return {
    brandName: isString(value.brandName) && value.brandName.trim()
      ? value.brandName
      : defaultSettings.brandName,
    supportEmail: coerceSupportEmail(value.supportEmail),
    taxRate: isRateValue(value.taxRate) ? value.taxRate : defaultSettings.taxRate,
    monthlyLoading: isRateValue(value.monthlyLoading)
      ? value.monthlyLoading
      : defaultSettings.monthlyLoading,
    loyaltyDiscountPerPolicy: isRateValue(value.loyaltyDiscountPerPolicy)
      ? value.loyaltyDiscountPerPolicy
      : defaultSettings.loyaltyDiscountPerPolicy,
    maxLoyaltyDiscount: isRateValue(value.maxLoyaltyDiscount)
      ? value.maxLoyaltyDiscount
      : defaultSettings.maxLoyaltyDiscount,
    quoteValidityDays: isQuoteValidityDays(value.quoteValidityDays)
      ? value.quoteValidityDays
      : defaultSettings.quoteValidityDays,
    enabledProducts: enabled.length > 0 ? enabled : defaultSettings.enabledProducts,
    integrations: coerceIntegrations(value.integrations),
  }
}

/** Reads integration configuration, falling back per integration to the defaults. */
function coerceIntegrations(value: unknown): IntegrationSettings {
  const stored = isRecord(value) ? value : {}
  const entries = integrationCatalog.map((integration) => {
    const fallback = defaultSettings.integrations[integration.id]
    const config = stored[integration.id]
    if (!isRecord(config)) {
      return [integration.id, fallback] as const
    }
    const baseUrl =
      isString(config.baseUrl) && isSupportedBaseUrl(config.baseUrl)
        ? config.baseUrl
        : fallback.baseUrl
    return [
      integration.id,
      {
        enabled: typeof config.enabled === 'boolean' ? config.enabled : fallback.enabled,
        baseUrl,
      },
    ] as const
  })
  return Object.fromEntries(entries) as IntegrationSettings
}

/** The number at the end of a reference such as QT-AUTO-00012. */
function referenceNumber(reference: string): number {
  const match = /(\d+)$/.exec(reference)
  const value = match ? Number(match[1]) : 0
  return Number.isSafeInteger(value) ? value : 0
}

/**
 * The stored sequence, raised to the highest reference already issued so a
 * corrupt or out of date counter can never hand out the same reference twice.
 */
function coerceSequence(value: unknown, references: string[]): number {
  const stored = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
  return references.reduce(
    (highest, reference) => Math.max(highest, referenceNumber(reference)),
    stored,
  )
}

/** Reads a whole application state, dropping anything that is not valid. */
export function coerceState(value: unknown): AppState {
  if (!isRecord(value)) {
    return emptyState
  }
  const quotes = Array.isArray(value.quotes) ? value.quotes.filter(isQuote) : []
  const policies = Array.isArray(value.policies)
    ? value.policies.filter(isStoredPolicy).map((policy) => withRiskAnswers(policy, quotes))
    : []
  const claims = Array.isArray(value.claims) ? value.claims.filter(isClaim) : []
  const sequences = isRecord(value.sequences) ? value.sequences : {}
  return {
    settings: coerceSettings(value.settings),
    quotes,
    policies,
    claims,
    sequences: {
      quote: coerceSequence(
        sequences.quote,
        quotes.map((quote) => quote.reference),
      ),
      policy: coerceSequence(
        sequences.policy,
        policies.map((policy) => policy.policyNumber),
      ),
      claim: coerceSequence(
        sequences.claim,
        claims.map((claim) => claim.reference),
      ),
    },
  }
}

/** Reads persisted state, falling back to an empty state when it is missing or corrupt. */
export function loadState(storage: Storage | undefined = safeStorage()): AppState {
  if (!storage) {
    return emptyState
  }
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw ? coerceState(JSON.parse(raw)) : emptyState
  } catch {
    return emptyState
  }
}

export function saveState(state: AppState, storage: Storage | undefined = safeStorage()): void {
  if (!storage) {
    return
  }
  try {
    const serialised = JSON.stringify(state)
    // Writing unchanged data would still notify every other open tab.
    if (storage.getItem(STORAGE_KEY) !== serialised) {
      storage.setItem(STORAGE_KEY, serialised)
    }
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
