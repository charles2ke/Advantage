import { products } from './catalog'
import type { ProductId } from './types'

/**
 * Platform wide configuration owned by the administrator. The values below are
 * the defaults the platform ships with; the admin portal edits a copy of them
 * which is persisted with the rest of the application state.
 */
export interface PlatformSettings {
  /** Name shown in the site header and footer. */
  brandName: string
  /** Address customers are pointed at for help. */
  supportEmail: string
  /** Insurance premium tax applied to the net premium, as a fraction. */
  taxRate: number
  /** Loading applied when the customer pays monthly instead of annually. */
  monthlyLoading: number
  /** Discount granted per policy already held, as a fraction. */
  loyaltyDiscountPerPolicy: number
  /** Cap on the total loyalty discount, as a fraction. */
  maxLoyaltyDiscount: number
  /** Number of days a quote stays valid. */
  quoteValidityDays: number
  /** Products customers can quote and buy. */
  enabledProducts: ProductId[]
}

export const defaultSettings: PlatformSettings = {
  brandName: 'Advantage',
  supportEmail: 'support@advantage.example',
  taxRate: 0.12,
  monthlyLoading: 0.05,
  loyaltyDiscountPerPolicy: 0.05,
  maxLoyaltyDiscount: 0.15,
  quoteValidityDays: 30,
  enabledProducts: products.map((product) => product.id),
}

export const MAX_RATE = 0.5
export const MIN_QUOTE_VALIDITY_DAYS = 1
export const MAX_QUOTE_VALIDITY_DAYS = 365

export function isRate(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= MAX_RATE
}

/** Validates settings entered in the admin portal, returning readable errors. */
export function validateSettings(settings: PlatformSettings): string[] {
  const errors: string[] = []

  if (!settings.brandName.trim()) {
    errors.push('Enter the name of the platform.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail)) {
    errors.push('Enter a valid support email address.')
  }
  if (!isRate(settings.taxRate)) {
    errors.push('Insurance premium tax must be between 0% and 50%.')
  }
  if (!isRate(settings.monthlyLoading)) {
    errors.push('The monthly instalment loading must be between 0% and 50%.')
  }
  if (!isRate(settings.loyaltyDiscountPerPolicy)) {
    errors.push('The loyalty discount per policy must be between 0% and 50%.')
  }
  if (!isRate(settings.maxLoyaltyDiscount)) {
    errors.push('The maximum loyalty discount must be between 0% and 50%.')
  }
  if (settings.maxLoyaltyDiscount < settings.loyaltyDiscountPerPolicy) {
    errors.push('The maximum loyalty discount cannot be lower than the discount per policy.')
  }
  if (
    !Number.isInteger(settings.quoteValidityDays) ||
    settings.quoteValidityDays < MIN_QUOTE_VALIDITY_DAYS ||
    settings.quoteValidityDays > MAX_QUOTE_VALIDITY_DAYS
  ) {
    errors.push(
      `Quote validity must be a whole number of days between ${MIN_QUOTE_VALIDITY_DAYS} and ${MAX_QUOTE_VALIDITY_DAYS}.`,
    )
  }
  if (settings.enabledProducts.length === 0) {
    errors.push('At least one product must be available to customers.')
  }

  return errors
}

export function isProductEnabled(settings: PlatformSettings, productId: ProductId): boolean {
  return settings.enabledProducts.includes(productId)
}

/** The catalogue filtered down to the products the administrator has enabled. */
export function availableProducts(settings: PlatformSettings) {
  return products.filter((product) => isProductEnabled(settings, product.id))
}
