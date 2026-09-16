import { describe, expect, it, vi } from 'vitest'
import { lookupPostcode, looksLikePostcode } from '../src/integrations/addressLookup'
import { convert, fetchExchangeRate, formatInCurrency } from '../src/integrations/exchangeRates'
import { integrationCatalog } from '../src/integrations/catalog'
import { isSupportedBaseUrl, normaliseBaseUrl } from '../src/integrations/http'
import type { Fetcher } from '../src/integrations/types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(response: Response | Error): Fetcher {
  return vi.fn(async () => {
    if (response instanceof Error) {
      throw response
    }
    return response
  })
}

const postcodePayload = {
  status: 200,
  result: {
    postcode: 'SW1A 2AA',
    country: 'England',
    region: 'London',
    admin_district: 'Westminster',
    latitude: 51.50354,
    longitude: -0.127695,
  },
}

describe('http helpers', () => {
  it('normalises base urls', () => {
    expect(normaliseBaseUrl(' https://api.example.com/// ')).toBe('https://api.example.com')
  })

  it('only accepts https endpoints, or local http ones', () => {
    expect(isSupportedBaseUrl('https://api.postcodes.io')).toBe(true)
    expect(isSupportedBaseUrl('http://localhost:4000')).toBe(true)
    expect(isSupportedBaseUrl('http://api.example.com')).toBe(false)
    expect(isSupportedBaseUrl('not a url')).toBe(false)
  })
})

describe('address lookup', () => {
  it('recognises the shape of a postcode before calling the service', async () => {
    expect(looksLikePostcode('sw1a 2aa')).toBe(true)
    expect(looksLikePostcode('nope')).toBe(false)

    const fetcher = stubFetch(jsonResponse(postcodePayload))
    const result = await lookupPostcode('nope', { fetcher })

    expect(result.ok).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('returns the district and region for a postcode', async () => {
    const fetcher = stubFetch(jsonResponse(postcodePayload))
    const result = await lookupPostcode('sw1a 2aa', { fetcher, baseUrl: 'https://example.test/' })

    expect(fetcher).toHaveBeenCalledWith(
      'https://example.test/postcodes/sw1a%202aa',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual({
      ok: true,
      data: {
        postcode: 'SW1A 2AA',
        country: 'England',
        region: 'London',
        district: 'Westminster',
        latitude: 51.50354,
        longitude: -0.127695,
      },
    })
  })

  it('explains an unknown postcode', async () => {
    const fetcher = stubFetch(jsonResponse({ status: 404, error: 'Postcode not found' }, 404))
    const result = await lookupPostcode('SW1A 2AB', { fetcher })

    expect(result).toEqual({ ok: false, error: 'We could not find the postcode SW1A 2AB.' })
  })

  it('reports an unexpected payload rather than throwing', async () => {
    const fetcher = stubFetch(jsonResponse({ unexpected: true }))
    const result = await lookupPostcode('SW1A 2AA', { fetcher })

    expect(result.ok).toBe(false)
  })

  it('reports a network failure rather than throwing', async () => {
    const fetcher = stubFetch(new TypeError('Failed to fetch'))
    const result = await lookupPostcode('SW1A 2AA', { fetcher })

    expect(result).toEqual({
      ok: false,
      error: 'The address lookup service could not be reached (Failed to fetch).',
    })
  })
})

describe('exchange rates', () => {
  it('reads the published rate for a currency', async () => {
    const fetcher = stubFetch(
      jsonResponse({ amount: 1, base: 'GBP', date: '2026-09-14', rates: { EUR: 1.1712 } }),
    )
    const result = await fetchExchangeRate('eur', { fetcher })

    expect(fetcher).toHaveBeenCalledWith(
      'https://api.frankfurter.app/latest?base=GBP&symbols=EUR',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(result).toEqual({
      ok: true,
      data: { base: 'GBP', target: 'EUR', rate: 1.1712, date: '2026-09-14' },
    })
  })

  it('does not call the service when the currencies match', async () => {
    const fetcher = stubFetch(jsonResponse({}))
    const result = await fetchExchangeRate('GBP', { fetcher })

    expect(result.ok && result.data.rate).toBe(1)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects a code that is not a currency', async () => {
    const fetcher = stubFetch(jsonResponse({}))
    const result = await fetchExchangeRate('pounds', { fetcher })

    expect(result.ok).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('reports a missing rate', async () => {
    const fetcher = stubFetch(jsonResponse({ base: 'GBP', date: '2026-09-14', rates: {} }))
    const result = await fetchExchangeRate('JPY', { fetcher })

    expect(result).toEqual({ ok: false, error: 'No exchange rate is published for JPY.' })
  })

  it('converts and formats an amount', () => {
    const rate = { base: 'GBP', target: 'EUR', rate: 1.1712, date: '2026-09-14' }

    expect(convert(431.2, rate)).toBe(505.02)
    expect(formatInCurrency(505.02, 'EUR')).toContain('505.02')
  })
})

describe('integration catalog', () => {
  it('summarises a successful connection test', async () => {
    const address = integrationCatalog[0]
    const result = await address.check({ fetcher: stubFetch(jsonResponse(postcodePayload)) })

    expect(result).toEqual({ ok: true, data: 'SW1A 2AA resolved to Westminster.' })
  })

  it('passes the failure of a connection test through', async () => {
    const rates = integrationCatalog[1]
    const result = await rates.check({ fetcher: stubFetch(jsonResponse({}, 503)) })

    expect(result).toEqual({
      ok: false,
      error: 'The exchange rate service answered with status 503.',
    })
  })

  it('ships an https endpoint for every integration', () => {
    for (const integration of integrationCatalog) {
      expect(isSupportedBaseUrl(integration.defaultBaseUrl)).toBe(true)
    }
  })
})
