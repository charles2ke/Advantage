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

/** Midnight UTC on the day of the given date, so dates compare at day granularity. */
function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0')
}

export function claimReference(sequence: number): string {
  return `CLM-${pad(sequence, 6)}`
}

export function validateClaimInput(
  input: ClaimInput,
  policy: Policy | undefined,
  now: Date = new Date(),
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

export function advanceClaim(
  claim: Claim,
  to: ClaimStatus,
  note: string,
  now: Date = new Date(),
): Claim {
  if (!canTransition(claim.status, to)) {
    throw new Error(`A ${claimStatusLabels[claim.status]} claim cannot move to ${claimStatusLabels[to]}.`)
  }
  return {
    ...claim,
    status: to,
    timeline: [...claim.timeline, { status: to, note, at: now.toISOString() }],
  }
}

/** The amount the customer receives once the policy excess is deducted. */
export function settlementAmount(claim: Claim, policy: Policy): number {
  return Math.max(0, Math.min(claim.amountClaimed, policy.sumInsured) - policy.excess)
}
