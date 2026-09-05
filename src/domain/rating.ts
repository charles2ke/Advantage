import { getProduct } from './catalog'
import { defaultSettings, type PlatformSettings } from './settings'
import type { Applicant, PremiumBreakdown, Product, Quote, QuoteInput } from './types'

/*
 * The constants below are the shipped defaults. They are the fallback whenever
 * no administrator configured settings are supplied (see `settings.ts` and the
 * admin portal).
 */

/** Insurance premium tax applied to the net premium. */
export const TAX_RATE = defaultSettings.taxRate
/** Loading applied when the customer pays monthly instead of annually. */
export const MONTHLY_LOADING = defaultSettings.monthlyLoading
/** Discount granted per policy already held, capped by MAX_LOYALTY_DISCOUNT. */
export const LOYALTY_DISCOUNT_PER_POLICY = defaultSettings.loyaltyDiscountPerPolicy
export const MAX_LOYALTY_DISCOUNT = defaultSettings.maxLoyaltyDiscount
/** Number of days a quote stays valid. */
export const QUOTE_VALIDITY_DAYS = defaultSettings.quoteValidityDays

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculateAge(dateOfBirth: string, on: Date): number {
  const born = new Date(dateOfBirth)
  if (Number.isNaN(born.getTime())) {
    return Number.NaN
  }
  let age = on.getUTCFullYear() - born.getUTCFullYear()
  const monthDiff = on.getUTCMonth() - born.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && on.getUTCDate() < born.getUTCDate())) {
    age -= 1
  }
  return age
}

export function ageMultiplier(product: Product, age: number): number {
  const band = product.ageBands.find((candidate) => age <= candidate.maxAge)
  return band ? band.multiplier : 1
}

function riskMultiplier(product: Product, riskAnswers: Record<string, string>): number {
  return product.riskFactors.reduce((multiplier, factor) => {
    const answer = riskAnswers[factor.id]
    const option = factor.options.find((candidate) => candidate.value === answer)
    return multiplier * (option ? option.multiplier : 1)
  }, 1)
}

function excessMultiplier(product: Product, excess: number): number {
  const option = product.excessOptions.find((candidate) => candidate.value === excess)
  return option ? option.multiplier : 1
}

function coverageRate(product: Product, coverageIds: string[]): number {
  return product.coverages
    .filter((coverage) => coverageIds.includes(coverage.id))
    .reduce((total, coverage) => total + coverage.rate, 0)
}

export function loyaltyRate(
  existingPolicies: number,
  settings: PlatformSettings = defaultSettings,
): number {
  const policies = Math.max(0, Math.floor(existingPolicies))
  return Math.min(policies * settings.loyaltyDiscountPerPolicy, settings.maxLoyaltyDiscount)
}

/**
 * Rates a quote request. The engine is deterministic: the same input always
 * produces the same premium, which keeps quotes reproducible and testable.
 */
export function ratePremium(
  input: QuoteInput,
  now: Date = new Date(),
  settings: PlatformSettings = defaultSettings,
): PremiumBreakdown {
  const product = getProduct(input.productId)
  const sumInsured = Math.min(
    Math.max(input.sumInsured, product.sumInsured.min),
    product.sumInsured.max,
  )

  const base = roundCurrency(
    product.basePremium + (sumInsured / 1000) * product.ratePerThousand,
  )

  const age = calculateAge(input.applicant.dateOfBirth, now)
  const multiplier =
    (Number.isNaN(age) ? 1 : ageMultiplier(product, age)) *
    riskMultiplier(product, input.riskAnswers)
  const riskAdjustment = roundCurrency(base * multiplier - base)

  const riskAdjusted = base + riskAdjustment
  const coverageAdditions = roundCurrency(riskAdjusted * coverageRate(product, input.coverageIds))

  const withCoverages = riskAdjusted + coverageAdditions
  const excessAdjustment = roundCurrency(
    withCoverages * excessMultiplier(product, input.excess) - withCoverages,
  )

  const subtotal = withCoverages + excessAdjustment
  const loyaltyDiscount = roundCurrency(subtotal * loyaltyRate(input.existingPolicies, settings))

  const netPremium = roundCurrency(
    Math.max(subtotal - loyaltyDiscount, product.minimumPremium),
  )
  const tax = roundCurrency(netPremium * settings.taxRate)
  const total = roundCurrency(netPremium + tax)
  const monthly = roundCurrency((total * (1 + settings.monthlyLoading)) / 12)

  return {
    base,
    riskAdjustment,
    coverageAdditions,
    excessAdjustment,
    loyaltyDiscount,
    netPremium,
    tax,
    total,
    monthly,
  }
}

export function validateApplicant(applicant: Applicant, now: Date = new Date()): string[] {
  const errors: string[] = []

  if (!applicant.fullName.trim()) {
    errors.push('Enter the name of the person to be insured.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) {
    errors.push('Enter a valid email address.')
  }
  if (!applicant.postcode.trim()) {
    errors.push('Enter a postcode.')
  }

  const age = calculateAge(applicant.dateOfBirth, now)
  if (Number.isNaN(age)) {
    errors.push('Enter a valid date of birth.')
  } else if (age < 18) {
    errors.push('The policyholder must be at least 18 years old.')
  } else if (age > 100) {
    errors.push('Enter a valid date of birth.')
  }

  return errors
}

export function validateQuoteInput(input: QuoteInput, now: Date = new Date()): string[] {
  const product = getProduct(input.productId)
  const errors: string[] = validateApplicant(input.applicant, now)

  if (
    input.sumInsured < product.sumInsured.min ||
    input.sumInsured > product.sumInsured.max
  ) {
    errors.push(
      `${product.sumInsured.label} must be between ${product.sumInsured.min} and ${product.sumInsured.max}.`,
    )
  }

  for (const factor of product.riskFactors) {
    const answer = input.riskAnswers[factor.id]
    if (!factor.options.some((option) => option.value === answer)) {
      errors.push(`Answer the question: ${factor.label}`)
    }
  }

  return errors
}

function pad(value: number, length: number): string {
  return value.toString().padStart(length, '0')
}

export function quoteReference(productId: string, sequence: number): string {
  return `QT-${productId.toUpperCase()}-${pad(sequence, 5)}`
}

export function createQuote(
  input: QuoteInput,
  options: { id: string; sequence: number; now?: Date; settings?: PlatformSettings },
): Quote {
  const now = options.now ?? new Date()
  const settings = options.settings ?? defaultSettings
  const expiresAt = new Date(now.getTime() + settings.quoteValidityDays * 24 * 60 * 60 * 1000)

  return {
    id: options.id,
    reference: quoteReference(input.productId, options.sequence),
    productId: input.productId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    input,
    premium: ratePremium(input, now, settings),
  }
}
