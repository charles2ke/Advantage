import { describe, expect, it } from 'vitest'
import {
  advanceClaim,
  canTransition,
  claimReference,
  createClaim,
  settlementAmount,
  validateClaimInput,
  type ClaimInput,
} from '../src/domain/claims'
import { issuePolicy } from '../src/domain/policies'
import { createQuote } from '../src/domain/rating'
import type { QuoteInput } from '../src/domain/types'

const now = new Date('2026-06-01T00:00:00.000Z')

const quoteInput: QuoteInput = {
  productId: 'auto',
  applicant: {
    fullName: 'Alex Turner',
    email: 'alex@example.com',
    dateOfBirth: '1986-01-01',
    postcode: 'M1 2AB',
  },
  sumInsured: 20000,
  excess: 500,
  coverageIds: [],
  riskAnswers: { usage: 'social', claims: 'none', parking: 'driveway' },
  existingPolicies: 0,
}

const policy = issuePolicy(
  createQuote(quoteInput, { id: 'quote-1', sequence: 1, now: new Date('2026-01-01T00:00:00.000Z') }),
  { id: 'policy-1', sequence: 1, startDate: new Date('2026-01-01T00:00:00.000Z') },
)

function claimInput(overrides: Partial<ClaimInput> = {}): ClaimInput {
  return {
    policyNumber: policy.policyNumber,
    incidentDate: '2026-05-20',
    description: 'Rear ended at a set of traffic lights on the ring road.',
    amountClaimed: 2400,
    ...overrides,
  }
}

describe('claimReference', () => {
  it('is zero padded', () => {
    expect(claimReference(12)).toBe('CLM-000012')
  })
})

describe('validateClaimInput', () => {
  it('accepts a complete claim', () => {
    expect(validateClaimInput(claimInput(), policy, now)).toEqual([])
  })

  it('requires a policy', () => {
    expect(validateClaimInput(claimInput(), undefined, now)).toContain(
      'Select the policy the claim relates to.',
    )
  })

  it('rejects an incident in the future', () => {
    expect(validateClaimInput(claimInput({ incidentDate: '2026-12-01' }), policy, now)).toContain(
      'The incident date cannot be in the future.',
    )
  })

  it('rejects an incident before the policy started', () => {
    expect(validateClaimInput(claimInput({ incidentDate: '2025-12-01' }), policy, now)).toContain(
      'The incident happened before the policy started.',
    )
  })

  it('requires a meaningful description', () => {
    expect(validateClaimInput(claimInput({ description: 'Bumped it' }), policy, now)).toContain(
      'Describe what happened in at least 20 characters.',
    )
  })

  it('rejects an amount above the sum insured', () => {
    expect(validateClaimInput(claimInput({ amountClaimed: 99_000 }), policy, now)).toContain(
      'The amount claimed cannot exceed the sum insured.',
    )
  })

  it('rejects a claim on a cancelled policy', () => {
    expect(
      validateClaimInput(claimInput(), { ...policy, status: 'cancelled' }, now),
    ).toContain('This policy has been cancelled and cannot be claimed against.')
  })
})

describe('createClaim', () => {
  it('starts in the submitted state with an opening timeline entry', () => {
    const claim = createClaim(claimInput(), policy, { id: 'claim-1', sequence: 4, now })

    expect(claim.reference).toBe('CLM-000004')
    expect(claim.status).toBe('submitted')
    expect(claim.policyNumber).toBe(policy.policyNumber)
    expect(claim.timeline).toHaveLength(1)
    expect(claim.timeline[0].status).toBe('submitted')
  })
})

describe('claim transitions', () => {
  const claim = createClaim(claimInput(), policy, { id: 'claim-1', sequence: 1, now })

  it('allows the documented transitions only', () => {
    expect(canTransition('submitted', 'in_review')).toBe(true)
    expect(canTransition('submitted', 'settled')).toBe(false)
    expect(canTransition('declined', 'approved')).toBe(false)
  })

  it('records each step on the timeline', () => {
    const reviewed = advanceClaim(claim, 'in_review', 'Handler assigned.', now)
    const approved = advanceClaim(reviewed, 'approved', 'Cover confirmed.', now)

    expect(approved.status).toBe('approved')
    expect(approved.timeline.map((event) => event.status)).toEqual([
      'submitted',
      'in_review',
      'approved',
    ])
  })

  it('refuses an invalid transition', () => {
    expect(() => advanceClaim(claim, 'settled', 'Paid.', now)).toThrow()
  })
})

describe('settlementAmount', () => {
  it('deducts the policy excess', () => {
    const claim = createClaim(claimInput(), policy, { id: 'claim-1', sequence: 1, now })
    expect(settlementAmount(claim, policy)).toBe(1900)
  })

  it('never returns a negative settlement', () => {
    const claim = createClaim(claimInput({ amountClaimed: 100 }), policy, {
      id: 'claim-1',
      sequence: 1,
      now,
    })
    expect(settlementAmount(claim, policy)).toBe(0)
  })
})
