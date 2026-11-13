import { getProduct } from './catalog'
import { claimsInCurrentTerm } from './claims'
import { daysBetween } from './dates'
import { ratePremium, roundCurrency } from './rating'
import type { PlatformSettings } from './settings'
import type { Claim, Policy, PolicyStatus, PremiumBreakdown, Quote } from './types'

export const POLICY_TERM_MONTHS = 12
/** Renewal opens this many days before the policy expires. */
export const RENEWAL_WINDOW_DAYS = 30

export const policyStatusLabels: Record<PolicyStatus, string> = {
  active: 'Active',
  lapsed: 'Lapsed',
  cancelled: 'Cancelled',
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0')
}

export function policyNumber(productId: string, sequence: number): string {
  return `ADV-${productId.toUpperCase()}-${pad(sequence, 6)}`
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDayOfMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate()
  result.setUTCDate(Math.min(day, lastDayOfMonth))
  return result
}

/** Converts an accepted quote into an active policy. */
export function issuePolicy(
  quote: Quote,
  options: { id: string; sequence: number; startDate?: Date },
): Policy {
  const startDate = options.startDate ?? new Date()
  const endDate = addMonths(startDate, POLICY_TERM_MONTHS)

  return {
    id: options.id,
    policyNumber: policyNumber(quote.productId, options.sequence),
    productId: quote.productId,
    status: 'active',
    holder: quote.input.applicant,
    sumInsured: quote.input.sumInsured,
    excess: quote.input.excess,
    coverageIds: [...quote.input.coverageIds],
    riskAnswers: { ...quote.input.riskAnswers },
    premium: quote.premium,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    quoteReference: quote.reference,
  }
}

export function policyStatusOn(policy: Policy, on: Date): PolicyStatus {
  if (policy.status === 'cancelled') {
    return 'cancelled'
  }
  return new Date(policy.endDate).getTime() <= on.getTime() ? 'lapsed' : 'active'
}

/**
 * Renewal opens in the 30 days before expiry and stays open afterwards, so a
 * lapsed policy can still be reinstated by the policyholder.
 */
export function isRenewable(policy: Policy, on: Date, withinDays = RENEWAL_WINDOW_DAYS): boolean {
  if (policy.status === 'cancelled') {
    return false
  }
  const millisecondsUntilExpiry = new Date(policy.endDate).getTime() - on.getTime()
  return millisecondsUntilExpiry <= withinDays * 24 * 60 * 60 * 1000
}

/** The next term starts when the current one ends, or straight away if the policy has lapsed. */
export function renewalStartDate(policy: Policy, on: Date): Date {
  return new Date(policy.endDate).getTime() > on.getTime() ? new Date(policy.endDate) : on
}

/**
 * Prices the next term of a policy with the current settings, the holder's age
 * when the new term starts and the number of other policies they hold. The
 * current premium is kept when the stored risk answers are incomplete, for
 * example on a policy saved by an older version of the platform.
 */
export function rateRenewal(
  policy: Policy,
  options: { on: Date; settings: PlatformSettings; existingPolicies: number },
): PremiumBreakdown {
  const product = getProduct(policy.productId)
  const fullyAnswered = product.riskFactors.every((factor) =>
    factor.options.some((option) => option.value === policy.riskAnswers[factor.id]),
  )
  if (!fullyAnswered) {
    return policy.premium
  }
  return ratePremium(
    {
      productId: policy.productId,
      applicant: policy.holder,
      sumInsured: policy.sumInsured,
      excess: policy.excess,
      coverageIds: policy.coverageIds,
      riskAnswers: policy.riskAnswers,
      existingPolicies: options.existingPolicies,
    },
    renewalStartDate(policy, options.on),
    options.settings,
  )
}

export function renewPolicy(
  policy: Policy,
  on: Date = new Date(),
  premium: PremiumBreakdown = policy.premium,
): Policy {
  const startDate = renewalStartDate(policy, on)
  return {
    ...policy,
    status: 'active',
    premium,
    startDate: startDate.toISOString(),
    endDate: addMonths(startDate, POLICY_TERM_MONTHS).toISOString(),
  }
}

/**
 * Premium returned when a policy is cancelled: the unused days of the current
 * term, pro rata, so cancelling before the term starts returns everything. No
 * refund is due once a claim has been made in the current period of cover,
 * unless that claim was declined.
 */
export function cancellationRefund(
  policy: Policy,
  on: Date = new Date(),
  claims: Claim[] = [],
): number {
  if (policy.status === 'cancelled' || claimsInCurrentTerm(policy, claims).length > 0) {
    return 0
  }
  const start = new Date(policy.startDate)
  const termDays = daysBetween(start, new Date(policy.endDate))
  if (termDays <= 0) {
    return 0
  }
  const usedDays = Math.min(Math.max(daysBetween(start, on), 0), termDays)
  return roundCurrency((policy.premium.total * (termDays - usedDays)) / termDays)
}

export function cancelPolicy(policy: Policy, on: Date = new Date(), claims: Claim[] = []): Policy {
  if (policy.status === 'cancelled') {
    return policy
  }
  return {
    ...policy,
    status: 'cancelled',
    cancelledAt: on.toISOString(),
    refund: cancellationRefund(policy, on, claims),
  }
}

/** Policies in force on the given date, used for the loyalty discount. */
export function countPoliciesInForce(
  policies: Policy[],
  on: Date,
  excludePolicyId?: string,
): number {
  return policies.filter(
    (policy) => policy.id !== excludePolicyId && policyStatusOn(policy, on) === 'active',
  ).length
}

export type PolicyFilterStatus = PolicyStatus | 'all'

export interface PolicyFilter {
  /** Free text matched against the policy number, product, policyholder and postcode. */
  query: string
  status: PolicyFilterStatus
}

export function filterPolicies(policies: Policy[], filter: PolicyFilter, on: Date): Policy[] {
  const query = filter.query.trim().toLowerCase()
  return policies.filter((policy) => {
    if (filter.status !== 'all' && policyStatusOn(policy, on) !== filter.status) {
      return false
    }
    if (!query) {
      return true
    }
    return [
      policy.policyNumber,
      policy.quoteReference,
      getProduct(policy.productId).name,
      policy.holder.fullName,
      policy.holder.postcode,
    ].some((value) => value.toLowerCase().includes(query))
  })
}
