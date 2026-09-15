import { getJson, normaliseBaseUrl } from './http'
import { failure, ok, type IntegrationOptions, type IntegrationResult } from './types'

/**
 * Address lookup backed by postcodes.io, the open data service built on the
 * Ordnance Survey and ONS postcode datasets. It needs no API key, which keeps
 * Advantage deployable as a static site.
 */
export const POSTCODES_API_BASE = 'https://api.postcodes.io'
export const POSTCODES_DOCS_URL = 'https://postcodes.io/docs'

export interface AddressDetails {
  /** Postcode in its official, normalised form. */
  postcode: string
  country: string
  region: string
  district: string
  latitude: number | null
  longitude: number | null
}

interface PostcodesResult {
  postcode: unknown
  country: unknown
  region: unknown
  admin_district: unknown
  latitude: unknown
  longitude: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown, fallback = 'Not published'): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function coordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** Local sanity check so an obviously wrong postcode never leaves the browser. */
export function looksLikePostcode(postcode: string): boolean {
  return /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(postcode.trim())
}

/** Looks a UK postcode up, returning the district and region held for it. */
export async function lookupPostcode(
  postcode: string,
  options: IntegrationOptions = {},
): Promise<IntegrationResult<AddressDetails>> {
  const trimmed = postcode.trim()
  if (!trimmed) {
    return failure('Enter a postcode to look up.')
  }
  if (!looksLikePostcode(trimmed)) {
    return failure(`${trimmed.toUpperCase()} is not a valid UK postcode.`)
  }

  const base = normaliseBaseUrl(options.baseUrl ?? POSTCODES_API_BASE)
  const response = await getJson<unknown>({
    ...options,
    url: `${base}/postcodes/${encodeURIComponent(trimmed)}`,
    serviceName: 'The address lookup service',
    onStatus: (status) =>
      status === 404 ? `We could not find the postcode ${trimmed.toUpperCase()}.` : undefined,
  })

  if (!response.ok) {
    return response
  }

  const payload = response.data
  if (!isRecord(payload) || !isRecord(payload.result)) {
    return failure('The address lookup service returned an unexpected response.')
  }

  const result = payload.result as unknown as PostcodesResult
  return ok({
    postcode: text(result.postcode, trimmed.toUpperCase()),
    country: text(result.country),
    region: text(result.region),
    district: text(result.admin_district),
    latitude: coordinate(result.latitude),
    longitude: coordinate(result.longitude),
  })
}
