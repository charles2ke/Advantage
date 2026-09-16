/**
 * Shared contract for the platform's integrations with external services.
 *
 * Every integration is a small function that takes the request data plus the
 * options below and resolves to a result object. Integrations never throw for
 * network or protocol problems: a failure is returned instead so the caller can
 * show a readable message and the journey can continue without the service.
 */

export interface IntegrationSuccess<T> {
  ok: true
  data: T
}

export interface IntegrationFailure {
  ok: false
  /** Message that is safe to show to a customer or an administrator. */
  error: string
}

export type IntegrationResult<T> = IntegrationSuccess<T> | IntegrationFailure

/** Minimal shape of `fetch` the integrations rely on, so it can be stubbed in tests. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

export interface IntegrationOptions {
  /** Base URL of the service, without a trailing slash. Defaults per integration. */
  baseUrl?: string
  /** Aborts the request after this many milliseconds. */
  timeoutMs?: number
  /** Injected by tests; defaults to the global `fetch`. */
  fetcher?: Fetcher
  /** Caller supplied abort signal, for example when a component unmounts. */
  signal?: AbortSignal
}

export const DEFAULT_TIMEOUT_MS = 8000

export function ok<T>(data: T): IntegrationSuccess<T> {
  return { ok: true, data }
}

export function failure(error: string): IntegrationFailure {
  return { ok: false, error }
}
