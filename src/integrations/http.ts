import {
  DEFAULT_TIMEOUT_MS,
  failure,
  ok,
  type Fetcher,
  type IntegrationOptions,
  type IntegrationResult,
} from './types'

export interface JsonRequest extends IntegrationOptions {
  /** Absolute URL of the resource to read. */
  url: string
  /** Shown when the service is unreachable or answers with an error. */
  serviceName: string
  /** Optional handler for a specific status, for example 404 on a lookup. */
  onStatus?: (status: number) => string | undefined
}

function resolveFetcher(fetcher: Fetcher | undefined): Fetcher | undefined {
  if (fetcher) {
    return fetcher
  }
  return typeof fetch === 'function' ? (input, init) => fetch(input, init) : undefined
}

/** Removes trailing slashes so a configured base URL can be joined safely. */
export function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

/** True for the `https:` (or local `http:`) URLs an administrator may configure. */
export function isSupportedBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === 'https:') {
    return true
  }
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

/**
 * Reads JSON from an external service. Network errors, timeouts, error statuses
 * and malformed payloads are all turned into a readable failure result.
 */
export async function getJson<T>(request: JsonRequest): Promise<IntegrationResult<T>> {
  const fetcher = resolveFetcher(request.fetcher)
  if (!fetcher) {
    return failure(`${request.serviceName} is unavailable in this environment.`)
  }

  const controller = new AbortController()
  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const abortFromCaller = () => controller.abort()
  request.signal?.addEventListener('abort', abortFromCaller)

  try {
    const response = await fetcher(request.url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      const mapped = request.onStatus?.(response.status)
      return failure(mapped ?? `${request.serviceName} answered with status ${response.status}.`)
    }

    const payload: unknown = await response.json()
    return ok(payload as T)
  } catch (error) {
    if (request.signal?.aborted) {
      return failure(`The ${request.serviceName} request was cancelled.`)
    }
    if (controller.signal.aborted) {
      return failure(`${request.serviceName} did not respond within ${timeoutMs / 1000} seconds.`)
    }
    const detail = error instanceof Error ? error.message : 'unknown error'
    return failure(`${request.serviceName} could not be reached (${detail}).`)
  } finally {
    clearTimeout(timer)
    request.signal?.removeEventListener('abort', abortFromCaller)
  }
}
