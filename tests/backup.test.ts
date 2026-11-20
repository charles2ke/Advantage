import { describe, expect, it } from 'vitest'
import type { QuoteInput } from '../src/domain/types'
import { appReducer, type AppAction } from '../src/state/appReducer'
import { backupFileName, createBackup, readBackup } from '../src/state/backup'
import { emptyState } from '../src/state/storage'

const now = new Date('2026-03-01T09:30:00.000Z')

const quoteInput: QuoteInput = {
  productId: 'travel',
  applicant: {
    fullName: 'Sam Okafor',
    email: 'sam@example.com',
    dateOfBirth: '1990-04-04',
    postcode: 'EH1 1AA',
  },
  sumInsured: 5000,
  excess: 75,
  coverageIds: ['gadget'],
  riskAnswers: { destination: 'europe', tripType: 'single' },
  existingPolicies: 0,
}

const actions: AppAction[] = [
  { type: 'quote/created', id: 'q1', input: quoteInput, now: '2026-01-01T00:00:00.000Z' },
  { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now: '2026-01-01T00:00:00.000Z' },
  {
    type: 'claim/created',
    id: 'c1',
    input: {
      policyNumber: 'ADV-TRAVEL-000001',
      incidentDate: '2026-02-10',
      description: 'Suitcase did not arrive at the destination airport.',
      amountClaimed: 800,
    },
    now: '2026-02-11T00:00:00.000Z',
  },
]
const state = actions.reduce(appReducer, emptyState)

describe('backups', () => {
  it('restores exactly what was backed up', () => {
    expect(readBackup(createBackup(state, now))).toEqual({
      ok: true,
      state,
      summary: {
        quotes: 1,
        policies: 1,
        claims: 1,
        skipped: 0,
        exportedAt: '2026-03-01T09:30:00.000Z',
      },
    })
  })

  it('leaves out records that are not valid and counts them', () => {
    const file = JSON.parse(createBackup(state, now))
    file.state.quotes.push('not a quote')
    file.state.claims.push({ id: 'broken' })

    const result = readBackup(JSON.stringify(file))

    expect(result.ok && result.summary).toMatchObject({ quotes: 1, claims: 1, skipped: 2 })
  })

  it.each([
    [
      'is not JSON',
      'not json',
      'This file could not be read. Choose a backup file downloaded from this page.',
    ],
    [
      'is not a backup',
      JSON.stringify({ quotes: [] }),
      'This file is not a backup of this platform.',
    ],
    [
      'comes from another version',
      JSON.stringify({ format: 'advantage-backup', version: 2, state: {} }),
      'This backup was made by a different version of the platform and cannot be restored.',
    ],
    [
      'has no data',
      JSON.stringify({ format: 'advantage-backup', version: 1 }),
      'This backup does not contain any data.',
    ],
  ])('rejects a file that %s', (_description, text, error) => {
    expect(readBackup(text)).toEqual({ ok: false, error })
  })

  it('names the file after the platform and the date', () => {
    expect(backupFileName('Northwind Cover', now)).toBe('northwind-cover-backup-2026-03-01.json')
    expect(backupFileName('***', now)).toBe('advantage-backup-2026-03-01.json')
  })
})
