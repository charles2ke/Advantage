import { getJson, normaliseBaseUrl } from './http'
import { failure, ok, type IntegrationOptions, type IntegrationResult } from './types'

/**
 * Foreign exchange rates from the Frankfurter API, which publishes the European
 * Central Bank reference rates. Travel customers use it to see the price in the
 * currency of the country they are travelling to.
 */
export const EXCHANGE_RATES_API_BASE = 'https://api.frankfurter.app'
export const EXCHANGE_RATES_DOCS_URL = 'https://www.frankfurter.app/docs'

export const BASE_CURRENCY = 'GBP'

/** Currencies customers can convert their price into. */
export const supportedCurrencies = [
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'JPY', name: 'Japanese yen' },
] as const

export interface ExchangeRate {
  base: string
  target: string
  rate: number
  /** Date the reference rate was published, as an ISO date. */
  date: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}

/** Reads the latest reference rate between two currencies. */
export async function fetchExchangeRate(
  target: string,
  options: IntegrationOptions & { base?: string } = {},
): Promise<IntegrationResult<ExchangeRate>> {
  const base = (options.base ?? BASE_CURRENCY).toUpperCase()
  const symbol = target.trim().toUpperCase()

  if (!isCurrencyCode(base) || !isCurrencyCode(symbol)) {
    return failure('Choose a three letter currency code, for example EUR.')
  }
  if (base === symbol) {
    return ok({ base, target: symbol, rate: 1, date: new Date().toISOString().slice(0, 10) })
  }

  const baseUrl = normaliseBaseUrl(options.baseUrl ?? EXCHANGE_RATES_API_BASE)
  const response = await getJson<unknown>({
    ...options,
    url: `${baseUrl}/latest?base=${base}&symbols=${symbol}`,
    serviceName: 'The exchange rate service',
  })

  if (!response.ok) {
    return response
  }

  const payload = response.data
  if (!isRecord(payload) || !isRecord(payload.rates)) {
    return failure('The exchange rate service returned an unexpected response.')
  }

  const rate = payload.rates[symbol]
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return failure(`No exchange rate is published for ${symbol}.`)
  }

  return ok({
    base,
    target: symbol,
    rate,
    date: typeof payload.date === 'string' ? payload.date : new Date().toISOString().slice(0, 10),
  })
}

/** Number of decimal places a currency's minor unit uses, e.g. 0 for JPY, 2 for GBP. */
function minorUnitDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}

/** Converts an amount with a rate, rounded to the target currency's minor unit. */
export function convert(amount: number, rate: ExchangeRate): number {
  const factor = 10 ** minorUnitDigits(rate.target)
  return Math.round(amount * rate.rate * factor) / factor
}

/** Formats a converted amount in the target currency. */
export function formatInCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}
