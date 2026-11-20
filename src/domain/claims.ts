import { startOfDay } from './dates'
import { formatCurrency } from './format'
import type { Claim, ClaimStatus, Policy } from './types'

export interface ClaimInput {
  policyNumber: string
  incidentDate: string
  description: string
  amountClaimed: number
}

export const claimStatusLabels: Record<ClaimStatus, string> = {
  submitted: 'Submitted',
  in_review: 'In review',
  approved: 'Approved',
  declined: 'Declined',
  settled: 'Settled',
}

/** Allowed status transitions for a claim, keyed by current status. */
export const claimTransitions: Record<ClaimStatus, ClaimStatus[]> = {
  submitted: ['in_review', 'declined'],
  in_review: ['approved', 'declined'],
  approved: ['settled'],
  declined: [],
  settled: [],
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0')
}

export function claimReference(sequence: number): string {
  return `CLM-${pad(sequence, 6)}`
}

/** Claims on the policy for incidents in its current period of cover, leaving out declined ones. */
export function claimsInCurrentTerm(policy: Policy, claims: Claim[]): Claim[] {
  const termStart = startOfDay(new Date(policy.startDate))
  return claims.filter(
    (claim) =>
      claim.policyNumber === policy.policyNumber &&
      claim.status !== 'declined' &&
      startOfDay(new Date(claim.incidentDate)) >= termStart,
  )
}

/** How much of the sum insured is still available to claim in the current period of cover. */
export function remainingSumInsured(policy: Policy, claims: Claim[]): number {
  const claimed = claimsInCurrentTerm(policy, claims).reduce(
    (total, claim) => total + claim.amountClaimed,
    0,
  )
  return Math.max(0, policy.sumInsured - claimed)
}

export function validateClaimInput(
  input: ClaimInput,
  policy: Policy | undefined,
  now: Date = new Date(),
  existingClaims: Claim[] = [],
): string[] {
  const errors: string[] = []

  if (!policy) {
    errors.push('Select the policy the claim relates to.')
  } else if (policy.status === 'cancelled') {
    errors.push('This policy has been cancelled and cannot be claimed against.')
  }

  const incident = new Date(input.incidentDate)
  if (!input.incidentDate || Number.isNaN(incident.getTime())) {
    errors.push('Enter the date of the incident.')
  } else if (startOfDay(incident) > startOfDay(now)) {
    errors.push('The incident date cannot be in the future.')
  } else if (policy && startOfDay(incident) < startOfDay(new Date(policy.startDate))) {
    errors.push('The incident happened before the policy started.')
  } else if (policy && startOfDay(incident) >= startOfDay(new Date(policy.endDate))) {
    errors.push('The incident happened after the policy ended.')
  }

  if (input.description.trim().length < 20) {
    errors.push('Describe what happened in at least 20 characters.')
  }

  if (!Number.isFinite(input.amountClaimed) || input.amountClaimed <= 0) {
    errors.push('Enter the amount you are claiming.')
  } else if (policy && input.amountClaimed > policy.sumInsured) {
    errors.push('The amount claimed cannot exceed the sum insured.')
  } else if (policy) {
    const remaining = remainingSumInsured(policy, existingClaims)
    if (input.amountClaimed > remaining) {
      errors.push(
        remaining === 0
          ? 'Earlier claims have used up the sum insured for this period of cover.'
          : `Earlier claims have used part of the sum insured, so you can claim up to ${formatCurrency(remaining)} for this period of cover.`,
      )
    }
  }

  return errors
}

export function createClaim(
  input: ClaimInput,
  policy: Policy,
  options: { id: string; sequence: number; now?: Date },
): Claim {
  const now = options.now ?? new Date()
  return {
    id: options.id,
    reference: claimReference(options.sequence),
    policyNumber: policy.policyNumber,
    productId: policy.productId,
    incidentDate: input.incidentDate,
    description: input.description.trim(),
    amountClaimed: input.amountClaimed,
    status: 'submitted',
    createdAt: now.toISOString(),
    timeline: [
      {
        status: 'submitted',
        note: 'Claim received. A handler will be assigned within one working day.',
        at: now.toISOString(),
      },
    ],
  }
}

export function canTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return claimTransitions[from].includes(to)
}

/**
 * Moves a claim on to its next status and records the step on the timeline.
 * When the claim is settled against its policy, the amount paid is recorded.
 */
export function advanceClaim(
  claim: Claim,
  to: ClaimStatus,
  note: string,
  now: Date = new Date(),
  policy?: Policy,
): Claim {
  if (!canTransition(claim.status, to)) {
    throw new Error(`A ${claimStatusLabels[claim.status]} claim cannot move to ${claimStatusLabels[to]}.`)
  }
  const advanced: Claim = {
    ...claim,
    status: to,
    timeline: [...claim.timeline, { status: to, note, at: now.toISOString() }],
  }
  return to === 'settled' && policy
    ? { ...advanced, settledAmount: settlementAmount(claim, policy) }
    : advanced
}

/** The amount the customer receives once the policy excess is deducted. */
export function settlementAmount(claim: Claim, policy: Policy): number {
  return Math.max(0, Math.min(claim.amountClaimed, policy.sumInsured) - policy.excess)
}

/** A claim is open while it can still move on to another status. */
export function isClaimOpen(claim: Claim): boolean {
  return claimTransitions[claim.status].length > 0
}

export type ClaimFilter = 'all' | 'open' | 'settled' | 'declined'

export const claimFilterLabels: Record<ClaimFilter, string> = {
  all: 'All claims',
  open: 'Open',
  settled: 'Settled',
  declined: 'Declined',
}

export function matchesClaimFilter(claim: Claim, filter: ClaimFilter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'open':
      return isClaimOpen(claim)
    default:
      return claim.status === filter
  }
}
