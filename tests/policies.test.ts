import { describe, expect, it } from 'vitest'
import { createClaim } from '../src/domain/claims'
import {
  addMonths,
  cancellationRefund,
  cancelPolicy,
  countPoliciesInForce,
  filterPolicies,
  isRenewable,
  issuePolicy,
  policyNumber,
  policyStatusOn,
  rateRenewal,
  renewPolicy,
} from '../src/domain/policies'
import { createQuote } from '../src/domain/rating'
import { defaultSettings } from '../src/domain/settings'
import type { QuoteInput } from '../src/domain/types'

const now = new Date('2026-01-01T00:00:00.000Z')

const input: QuoteInput = {
  productId: 'home',
  applicant: {
    fullName: 'Priya Shah',
    email: 'priya@example.com',
    dateOfBirth: '1980-06-15',
    postcode: 'BS1 4ST',
  },
  sumInsured: 250000,
  excess: 300,
  coverageIds: ['accidental'],
  riskAnswers: { propertyType: 'terraced', security: 'locks', floodRisk: 'low' },
  existingPolicies: 0,
}

const quote = createQuote(input, { id: 'quote-1', sequence: 1, now })

describe('policyNumber', () => {
  it('is prefixed with the product and zero padded', () => {
    expect(policyNumber('home', 42)).toBe('ADV-HOME-000042')
  })
})

describe('addMonths', () => {
  it('rolls over the year', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 12).toISOString()).toBe(
      '2027-01-31T00:00:00.000Z',
    )
  })

  it('clamps to the last day of a shorter month', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00.000Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
  })
})

describe('issuePolicy', () => {
  it('creates an active 12 month policy from the quote', () => {
    const policy = issuePolicy(quote, { id: 'policy-1', sequence: 3, startDate: now })

    expect(policy.policyNumber).toBe('ADV-HOME-000003')
    expect(policy.status).toBe('active')
    expect(policy.startDate).toBe('2026-01-01T00:00:00.000Z')
    expect(policy.endDate).toBe('2027-01-01T00:00:00.000Z')
    expect(policy.quoteReference).toBe(quote.reference)
    expect(policy.premium).toEqual(quote.premium)
    expect(policy.holder.fullName).toBe('Priya Shah')
  })
})

describe('policy lifecycle', () => {
  const policy = issuePolicy(quote, { id: 'policy-1', sequence: 1, startDate: now })

  it('lapses once the cover period has ended', () => {
    expect(policyStatusOn(policy, now)).toBe('active')
    expect(policyStatusOn(policy, new Date('2027-02-01T00:00:00.000Z'))).toBe('lapsed')
  })

  it('keeps a cancelled policy cancelled', () => {
    expect(policyStatusOn(cancelPolicy(policy), now)).toBe('cancelled')
  })

  it('only allows renewal in the 30 days before expiry', () => {
    expect(isRenewable(policy, now)).toBe(false)
    expect(isRenewable(policy, new Date('2026-12-20T00:00:00.000Z'))).toBe(true)
    expect(isRenewable(cancelPolicy(policy), new Date('2026-12-20T00:00:00.000Z'))).toBe(false)
  })

  it('stays renewable once it has lapsed, so it can be reinstated', () => {
    expect(isRenewable(policy, new Date('2027-06-01T00:00:00.000Z'))).toBe(true)
  })

  it('extends the cover period from the current expiry date', () => {
    const renewed = renewPolicy(policy, new Date('2026-12-20T00:00:00.000Z'))
    expect(renewed.startDate).toBe('2027-01-01T00:00:00.000Z')
    expect(renewed.endDate).toBe('2028-01-01T00:00:00.000Z')
    expect(renewed.status).toBe('active')
  })

  it('restarts an expired policy from the renewal date', () => {
    const renewed = renewPolicy(policy, new Date('2027-03-01T00:00:00.000Z'))
    expect(renewed.startDate).toBe('2027-03-01T00:00:00.000Z')
    expect(renewed.endDate).toBe('2028-03-01T00:00:00.000Z')
  })
})

describe('rateRenewal', () => {
  const policy = issuePolicy(quote, { id: 'policy-1', sequence: 1, startDate: now })
  const on = new Date('2026-12-20T00:00:00.000Z')

  it('prices the next term with the current settings', () => {
    const current = rateRenewal(policy, { on, settings: defaultSettings, existingPolicies: 0 })
    const afterTaxRise = rateRenewal(policy, {
      on,
      settings: { ...defaultSettings, taxRate: 0.2 },
      existingPolicies: 0,
    })

    expect(afterTaxRise.netPremium).toBe(current.netPremium)
    expect(afterTaxRise.tax).toBeGreaterThan(current.tax)
  })

  it('applies the loyalty discount for the other policies held', () => {
    const loyal = rateRenewal(policy, { on, settings: defaultSettings, existingPolicies: 2 })
    expect(loyal.loyaltyDiscount).toBeGreaterThan(0)
  })

  it('keeps the current premium when the risk answers were not recorded', () => {
    const legacy = { ...policy, riskAnswers: {} }
    expect(
      rateRenewal(legacy, { on, settings: { ...defaultSettings, taxRate: 0.2 }, existingPolicies: 0 }),
    ).toBe(legacy.premium)
  })
})

describe('cancellation', () => {
  // A premium of £365 makes the pro rata refund £1 for each unused day of cover.
  const policy = {
    ...issuePolicy(quote, { id: 'policy-1', sequence: 1, startDate: now }),
    premium: { ...quote.premium, total: 365 },
  }
  const hundredDaysIn = new Date('2026-04-11T10:00:00.000Z')
  const claim = createClaim(
    {
      policyNumber: policy.policyNumber,
      incidentDate: '2026-03-01',
      description: 'A burst pipe flooded the kitchen floor.',
      amountClaimed: 1200,
    },
    policy,
    { id: 'claim-1', sequence: 1, now: new Date('2026-03-02T00:00:00.000Z') },
  )

  it('refunds the premium for the unused days of cover', () => {
    expect(cancellationRefund(policy, hundredDaysIn)).toBe(265)
  })

  it('refunds everything when cover has not started yet', () => {
    expect(cancellationRefund(policy, new Date('2025-12-20T00:00:00.000Z'))).toBe(365)
  })

  it('refunds nothing once a claim has been made in the period of cover', () => {
    expect(cancellationRefund(policy, hundredDaysIn, [claim])).toBe(0)
    expect(cancellationRefund(policy, hundredDaysIn, [{ ...claim, status: 'declined' }])).toBe(265)
  })

  it('records when the policy was cancelled and the refund due', () => {
    expect(cancelPolicy(policy, hundredDaysIn)).toMatchObject({
      status: 'cancelled',
      cancelledAt: '2026-04-11T10:00:00.000Z',
      refund: 265,
    })
  })

  it('keeps the original record when a cancelled policy is cancelled again', () => {
    const cancelled = cancelPolicy(policy, hundredDaysIn)
    expect(cancelPolicy(cancelled, new Date('2026-06-01T00:00:00.000Z'))).toBe(cancelled)
  })
})

describe('countPoliciesInForce', () => {
  it('leaves out lapsed and cancelled policies and the policy being priced', () => {
    const policies = [
      issuePolicy(quote, { id: 'a', sequence: 1, startDate: now }),
      issuePolicy(quote, { id: 'b', sequence: 2, startDate: now }),
      issuePolicy(quote, { id: 'c', sequence: 3, startDate: new Date('2024-06-01T00:00:00.000Z') }),
      cancelPolicy(issuePolicy(quote, { id: 'd', sequence: 4, startDate: now }), now),
    ]

    expect(countPoliciesInForce(policies, now)).toBe(2)
    expect(countPoliciesInForce(policies, now, 'a')).toBe(1)
  })
})

describe('filterPolicies', () => {
  const current = issuePolicy(quote, { id: 'a', sequence: 1, startDate: now })
  const lapsed = {
    ...issuePolicy(quote, { id: 'b', sequence: 2, startDate: new Date('2024-06-01T00:00:00.000Z') }),
    holder: { ...input.applicant, fullName: 'Tom Reed', postcode: 'LS2 7EY' },
  }
  const policies = [current, lapsed]

  it('matches the policy number, policyholder or postcode, ignoring case', () => {
    expect(filterPolicies(policies, { query: 'adv-home-000002', status: 'all' }, now)).toEqual([
      lapsed,
    ])
    expect(filterPolicies(policies, { query: 'priya', status: 'all' }, now)).toEqual([current])
    expect(filterPolicies(policies, { query: ' ls2 ', status: 'all' }, now)).toEqual([lapsed])
  })

  it('filters by the status on the given date', () => {
    expect(filterPolicies(policies, { query: '', status: 'lapsed' }, now)).toEqual([lapsed])
    expect(filterPolicies(policies, { query: '', status: 'active' }, now)).toEqual([current])
  })
})
