import { describe, expect, it } from 'vitest'
import { getProduct } from '../src/domain/catalog'
import {
  MAX_LOYALTY_DISCOUNT,
  TAX_RATE,
  ageMultiplier,
  calculateAge,
  createQuote,
  loyaltyRate,
  ratePremium,
  roundCurrency,
  validateQuoteInput,
} from '../src/domain/rating'
import type { QuoteInput } from '../src/domain/types'

const now = new Date('2026-01-01T00:00:00.000Z')

function motorQuote(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
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
    ...overrides,
  }
}

describe('calculateAge', () => {
  it('counts completed years only', () => {
    expect(calculateAge('1986-01-01', now)).toBe(40)
    expect(calculateAge('1986-01-02', now)).toBe(39)
  })

  it('returns NaN for an invalid date', () => {
    expect(calculateAge('not-a-date', now)).toBeNaN()
  })
})

describe('ageMultiplier', () => {
  it('uses the first band that covers the age', () => {
    const motor = getProduct('auto')
    expect(ageMultiplier(motor, 20)).toBe(1.65)
    expect(ageMultiplier(motor, 40)).toBe(1)
    expect(ageMultiplier(motor, 80)).toBe(1.4)
  })
})

describe('loyaltyRate', () => {
  it('grows with each policy but is capped', () => {
    expect(loyaltyRate(0)).toBe(0)
    expect(loyaltyRate(2)).toBeCloseTo(0.1)
    expect(loyaltyRate(10)).toBe(MAX_LOYALTY_DISCOUNT)
  })
})

describe('ratePremium', () => {
  it('builds the premium from the base rate and the risk factors', () => {
    const premium = ratePremium(motorQuote(), now)

    // 240 flat + 20 * 18 per 1,000 of vehicle value
    expect(premium.base).toBe(600)
    // age 40 (x1), social use (x1), no claims (x0.9), driveway (x1)
    expect(premium.riskAdjustment).toBe(-60)
    expect(premium.netPremium).toBe(540)
    expect(premium.tax).toBe(roundCurrency(540 * TAX_RATE))
    expect(premium.total).toBe(604.8)
    expect(premium.monthly).toBe(52.92)
  })

  it('charges more for a younger driver', () => {
    const younger = ratePremium(
      motorQuote({
        applicant: { ...motorQuote().applicant, dateOfBirth: '2005-01-01' },
      }),
      now,
    )
    expect(younger.total).toBeGreaterThan(ratePremium(motorQuote(), now).total)
  })

  it('adds the cost of optional coverages', () => {
    const withExtras = ratePremium(motorQuote({ coverageIds: ['breakdown', 'legal'] }), now)
    // 12% of the risk adjusted premium of 540
    expect(withExtras.coverageAdditions).toBe(64.8)
    expect(withExtras.total).toBeGreaterThan(ratePremium(motorQuote(), now).total)
  })

  it('reduces the premium when a higher excess is chosen', () => {
    const higherExcess = ratePremium(motorQuote({ excess: 2000 }), now)
    expect(higherExcess.excessAdjustment).toBeLessThan(0)
    expect(higherExcess.total).toBeLessThan(ratePremium(motorQuote(), now).total)
  })

  it('applies the loyalty discount for existing customers', () => {
    const loyal = ratePremium(motorQuote({ existingPolicies: 2 }), now)
    expect(loyal.loyaltyDiscount).toBe(54)
    expect(loyal.netPremium).toBe(486)
  })

  it('never charges less than the product minimum premium', () => {
    const minimal = ratePremium(
      motorQuote({ sumInsured: 2000, excess: 2000, existingPolicies: 5 }),
      now,
    )
    expect(minimal.netPremium).toBe(getProduct('auto').minimumPremium)
  })

  it('clamps a sum insured outside the product range', () => {
    const clamped = ratePremium(motorQuote({ sumInsured: 10_000_000 }), now)
    const atMaximum = ratePremium(motorQuote({ sumInsured: 150_000 }), now)
    expect(clamped.total).toBe(atMaximum.total)
  })

  it('is deterministic', () => {
    expect(ratePremium(motorQuote(), now)).toEqual(ratePremium(motorQuote(), now))
  })
})

describe('validateQuoteInput', () => {
  it('accepts a complete request', () => {
    expect(validateQuoteInput(motorQuote(), now)).toEqual([])
  })

  it('rejects an applicant under 18', () => {
    const errors = validateQuoteInput(
      motorQuote({ applicant: { ...motorQuote().applicant, dateOfBirth: '2015-01-01' } }),
      now,
    )
    expect(errors).toContain('The policyholder must be at least 18 years old.')
  })

  it('rejects an invalid email address', () => {
    const errors = validateQuoteInput(
      motorQuote({ applicant: { ...motorQuote().applicant, email: 'alex.example.com' } }),
      now,
    )
    expect(errors).toContain('Enter a valid email address.')
  })

  it('requires every risk question to be answered', () => {
    const errors = validateQuoteInput(motorQuote({ riskAnswers: { usage: 'social' } }), now)
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('Claims in the last 5 years')
  })

  it('rejects a sum insured outside the product range', () => {
    const errors = validateQuoteInput(motorQuote({ sumInsured: 100 }), now)
    expect(errors.some((error) => error.includes('Vehicle value'))).toBe(true)
  })
})

describe('createQuote', () => {
  it('stamps a reference and a 30 day expiry', () => {
    const quote = createQuote(motorQuote(), { id: 'quote-1', sequence: 7, now })

    expect(quote.reference).toBe('QT-AUTO-00007')
    expect(quote.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(quote.expiresAt).toBe('2026-01-31T00:00:00.000Z')
    expect(quote.premium.total).toBe(604.8)
  })
})
