import { describe, expect, it } from 'vitest'
import { products } from '../src/domain/catalog'
import { createQuote, ratePremium } from '../src/domain/rating'
import {
  availableProducts,
  defaultSettings,
  isProductEnabled,
  validateSettings,
  type PlatformSettings,
} from '../src/domain/settings'
import type { QuoteInput } from '../src/domain/types'
import { appReducer } from '../src/state/appReducer'
import { coerceSettings, emptyState } from '../src/state/storage'

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
  riskAnswers: { usage: 'social', claims: 'none', parking: 'garage' },
  existingPolicies: 0,
}

function settings(overrides: Partial<PlatformSettings> = {}): PlatformSettings {
  return { ...defaultSettings, ...overrides }
}

describe('validateSettings', () => {
  it('accepts the shipped defaults', () => {
    expect(validateSettings(defaultSettings)).toEqual([])
  })

  it('rejects an empty name and an invalid support email', () => {
    const errors = validateSettings(settings({ brandName: '  ', supportEmail: 'nope' }))

    expect(errors).toContain('Enter the name of the platform.')
    expect(errors).toContain('Enter a valid support email address.')
  })

  it('rejects rates outside the allowed range', () => {
    const errors = validateSettings(settings({ taxRate: 0.9, monthlyLoading: -0.1 }))

    expect(errors).toHaveLength(2)
  })

  it('rejects a maximum loyalty discount below the discount per policy', () => {
    const errors = validateSettings(
      settings({ loyaltyDiscountPerPolicy: 0.2, maxLoyaltyDiscount: 0.1 }),
    )

    expect(errors).toContain(
      'The maximum loyalty discount cannot be lower than the discount per policy.',
    )
  })

  it('rejects an invalid quote validity and an empty catalogue', () => {
    const errors = validateSettings(settings({ quoteValidityDays: 0, enabledProducts: [] }))

    expect(errors).toHaveLength(2)
  })
})

describe('product availability', () => {
  it('filters the catalogue down to the enabled products', () => {
    const configured = settings({ enabledProducts: ['home'] })

    expect(availableProducts(configured).map((product) => product.id)).toEqual(['home'])
    expect(isProductEnabled(configured, 'auto')).toBe(false)
  })

  it('enables every product by default', () => {
    expect(availableProducts(defaultSettings)).toHaveLength(products.length)
  })
})

describe('settings drive the rating engine', () => {
  it('applies the configured tax rate and monthly loading', () => {
    const configured = settings({ taxRate: 0.2, monthlyLoading: 0 })
    const premium = ratePremium(quoteInput, now, configured)

    expect(premium.tax).toBeCloseTo(premium.netPremium * 0.2, 2)
    expect(premium.monthly).toBeCloseTo(premium.total / 12, 2)
  })

  it('applies the configured loyalty discount cap', () => {
    const capped = ratePremium(
      { ...quoteInput, existingPolicies: 4 },
      now,
      settings({ maxLoyaltyDiscount: 0.05 }),
    )
    const uncapped = ratePremium({ ...quoteInput, existingPolicies: 4 }, now)

    expect(capped.total).toBeGreaterThan(uncapped.total)
  })

  it('applies the configured quote validity', () => {
    const quote = createQuote(quoteInput, {
      id: 'quote-1',
      sequence: 1,
      now,
      settings: settings({ quoteValidityDays: 7 }),
    })

    expect(quote.expiresAt).toBe('2026-06-08T00:00:00.000Z')
  })
})

describe('settings in the reducer', () => {
  it('stores updated settings and uses them for new quotes', () => {
    const configured = settings({ quoteValidityDays: 10 })
    const updated = appReducer(emptyState, { type: 'settings/updated', settings: configured })

    expect(updated.settings.quoteValidityDays).toBe(10)

    const withQuote = appReducer(updated, {
      type: 'quote/created',
      id: 'q1',
      input: quoteInput,
      now: now.toISOString(),
    })

    expect(withQuote.quotes[0].expiresAt).toBe('2026-06-11T00:00:00.000Z')
  })

  it('restores the defaults', () => {
    const updated = appReducer(emptyState, {
      type: 'settings/updated',
      settings: settings({ brandName: 'Acme' }),
    })

    expect(appReducer(updated, { type: 'settings/reset' }).settings).toEqual(defaultSettings)
  })

  it('keeps the settings when the data is cleared', () => {
    const configured = settings({ brandName: 'Acme' })
    const updated = appReducer(emptyState, { type: 'settings/updated', settings: configured })
    const cleared = appReducer(updated, { type: 'state/reset' })

    expect(cleared.settings).toEqual(configured)
    expect(cleared.quotes).toEqual([])
  })
})

describe('coerceSettings', () => {
  it('falls back to the defaults for missing or invalid values', () => {
    expect(coerceSettings(undefined)).toEqual(defaultSettings)
    expect(coerceSettings({ brandName: '  ', taxRate: 'high', enabledProducts: ['nope'] })).toEqual(
      defaultSettings,
    )
  })

  it('falls back for invalid persisted email, rates, and quote validity', () => {
    expect(
      coerceSettings({
        supportEmail: 'not an email',
        taxRate: 0.51,
        monthlyLoading: -0.01,
        loyaltyDiscountPerPolicy: 0.6,
        maxLoyaltyDiscount: Number.NaN,
        quoteValidityDays: 1.5,
      }),
    ).toEqual(defaultSettings)
  })

  it('keeps valid stored values', () => {
    expect(coerceSettings({ brandName: 'Acme', enabledProducts: ['home', 'nope'] })).toEqual({
      ...defaultSettings,
      brandName: 'Acme',
      enabledProducts: ['home'],
    })
  })
})
