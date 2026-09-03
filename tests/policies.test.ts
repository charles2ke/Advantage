import { describe, expect, it } from 'vitest'
import {
  addMonths,
  cancelPolicy,
  isRenewable,
  issuePolicy,
  policyNumber,
  policyStatusOn,
  renewPolicy,
} from '../src/domain/policies'
import { createQuote } from '../src/domain/rating'
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
