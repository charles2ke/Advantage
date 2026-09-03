import type { Policy, PolicyStatus, Quote } from './types'

export const POLICY_TERM_MONTHS = 12

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

export function isRenewable(policy: Policy, on: Date, withinDays = 30): boolean {
  if (policy.status === 'cancelled') {
    return false
  }
  const millisecondsUntilExpiry = new Date(policy.endDate).getTime() - on.getTime()
  return millisecondsUntilExpiry <= withinDays * 24 * 60 * 60 * 1000
}

export function renewPolicy(policy: Policy, on: Date = new Date()): Policy {
  const startDate = new Date(policy.endDate).getTime() > on.getTime() ? new Date(policy.endDate) : on
  return {
    ...policy,
    status: 'active',
    startDate: startDate.toISOString(),
    endDate: addMonths(startDate, POLICY_TERM_MONTHS).toISOString(),
  }
}

export function cancelPolicy(policy: Policy): Policy {
  return { ...policy, status: 'cancelled' }
}
