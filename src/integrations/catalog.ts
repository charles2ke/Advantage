import { lookupPostcode, POSTCODES_API_BASE, POSTCODES_DOCS_URL } from './addressLookup'
import {
  EXCHANGE_RATES_API_BASE,
  EXCHANGE_RATES_DOCS_URL,
  fetchExchangeRate,
} from './exchangeRates'
import type { IntegrationOptions, IntegrationResult } from './types'

export type IntegrationId = 'addressLookup' | 'exchangeRates'

export interface IntegrationDefinition {
  id: IntegrationId
  name: string
  /** What the integration does for the platform. */
  description: string
  /** Service the data comes from. */
  provider: string
  docsUrl: string
  defaultBaseUrl: string
  /**
   * Calls the service with a known request so an administrator can confirm the
   * configuration works. Resolves to a short summary of the live response.
   */
  check: (options?: IntegrationOptions) => Promise<IntegrationResult<string>>
}

/** Postcode used for the address lookup connection test (10 Downing Street). */
export const CHECK_POSTCODE = 'SW1A 2AA'

export const integrationCatalog: IntegrationDefinition[] = [
  {
    id: 'addressLookup',
    name: 'Address lookup',
    description:
      'Verifies the postcode a customer enters and shows the district and region it belongs to.',
    provider: 'postcodes.io (Ordnance Survey and ONS open data)',
    docsUrl: POSTCODES_DOCS_URL,
    defaultBaseUrl: POSTCODES_API_BASE,
    check: async (options = {}) => {
      const result = await lookupPostcode(CHECK_POSTCODE, options)
      return result.ok
        ? { ok: true, data: `${result.data.postcode} resolved to ${result.data.district}.` }
        : result
    },
  },
  {
    id: 'exchangeRates',
    name: 'Exchange rates',
    description:
      'Shows the price of a quote in another currency using published reference rates.',
    provider: 'Frankfurter (European Central Bank reference rates)',
    docsUrl: EXCHANGE_RATES_DOCS_URL,
    defaultBaseUrl: EXCHANGE_RATES_API_BASE,
    check: async (options = {}) => {
      const result = await fetchExchangeRate('EUR', options)
      return result.ok
        ? { ok: true, data: `1 ${result.data.base} = ${result.data.rate} EUR on ${result.data.date}.` }
        : result
    },
  },
]

export function findIntegration(id: IntegrationId): IntegrationDefinition {
  const definition = integrationCatalog.find((candidate) => candidate.id === id)
  if (!definition) {
    throw new Error(`Unknown integration: ${id}`)
  }
  return definition
}
