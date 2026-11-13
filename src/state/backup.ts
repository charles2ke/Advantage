import { coerceState, type AppState } from './storage'

export const BACKUP_FORMAT = 'advantage-backup'
export const BACKUP_VERSION = 1

export interface BackupSummary {
  quotes: number
  policies: number
  claims: number
  /** Records in the file that are not valid and will not be restored. */
  skipped: number
  exportedAt: string
}

export type BackupReadResult =
  | { ok: true; state: AppState; summary: BackupSummary }
  | { ok: false; error: string }

/** Serialises the whole platform state into a backup file. */
export function createBackup(state: AppState, now: Date = new Date()): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), state },
    null,
    2,
  )
}

export function backupFileName(brandName: string, now: Date = new Date()): string {
  const slug =
    brandName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'advantage'
  return `${slug}-backup-${now.toISOString().slice(0, 10)}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function count(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

/**
 * Reads a backup file. Invalid records are dropped with the same rules used
 * for data saved in the browser, and reported in the summary as skipped.
 */
export function readBackup(text: string): BackupReadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file could not be read. Choose a backup file downloaded from this page.' }
  }
  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a backup of this platform.' }
  }
  if (parsed.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: 'This backup was made by a different version of the platform and cannot be restored.',
    }
  }
  if (!isRecord(parsed.state)) {
    return { ok: false, error: 'This backup does not contain any data.' }
  }

  const stored = parsed.state
  const state = coerceState(stored)
  const records = count(stored.quotes) + count(stored.policies) + count(stored.claims)
  const restored = state.quotes.length + state.policies.length + state.claims.length
  return {
    ok: true,
    state,
    summary: {
      quotes: state.quotes.length,
      policies: state.policies.length,
      claims: state.claims.length,
      skipped: records - restored,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    },
  }
}
