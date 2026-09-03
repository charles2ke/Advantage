import { describe, expect, it } from 'vitest'
import { appReducer, type AppAction } from '../src/state/appReducer'
import { emptyState, loadState, saveState, STORAGE_KEY } from '../src/state/storage'
import type { QuoteInput } from '../src/domain/types'

const now = '2026-01-01T00:00:00.000Z'

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

function run(actions: AppAction[]) {
  return actions.reduce(appReducer, emptyState)
}

describe('appReducer', () => {
  it('stores a new quote and advances the quote sequence', () => {
    const state = run([{ type: 'quote/created', id: 'q1', input: quoteInput, now }])

    expect(state.quotes).toHaveLength(1)
    expect(state.quotes[0].reference).toBe('QT-TRAVEL-00001')
    expect(state.sequences.quote).toBe(1)
  })

  it('issues a policy when a quote is accepted', () => {
    const state = run([
      { type: 'quote/created', id: 'q1', input: quoteInput, now },
      { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now },
    ])

    expect(state.policies).toHaveLength(1)
    expect(state.policies[0].policyNumber).toBe('ADV-TRAVEL-000001')
    expect(state.policies[0].quoteReference).toBe('QT-TRAVEL-00001')
  })

  it('does not issue a second policy for the same quote', () => {
    const state = run([
      { type: 'quote/created', id: 'q1', input: quoteInput, now },
      { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now },
      { type: 'quote/accepted', id: 'p2', quoteId: 'q1', now },
    ])

    expect(state.policies).toHaveLength(1)
  })

  it('ignores acceptance of an unknown quote', () => {
    const state = run([{ type: 'quote/accepted', id: 'p1', quoteId: 'missing', now }])
    expect(state.policies).toHaveLength(0)
  })

  it('cancels a policy', () => {
    const state = run([
      { type: 'quote/created', id: 'q1', input: quoteInput, now },
      { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now },
      { type: 'policy/cancelled', policyId: 'p1' },
    ])

    expect(state.policies[0].status).toBe('cancelled')
  })

  it('records a claim against an existing policy and moves it through its lifecycle', () => {
    const state = run([
      { type: 'quote/created', id: 'q1', input: quoteInput, now },
      { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now },
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
      {
        type: 'claim/advanced',
        claimId: 'c1',
        status: 'in_review',
        note: 'Handler assigned.',
        now: '2026-02-12T00:00:00.000Z',
      },
    ])

    expect(state.claims).toHaveLength(1)
    expect(state.claims[0].reference).toBe('CLM-000001')
    expect(state.claims[0].status).toBe('in_review')
  })

  it('ignores a claim for an unknown policy', () => {
    const state = run([
      {
        type: 'claim/created',
        id: 'c1',
        input: {
          policyNumber: 'ADV-TRAVEL-999999',
          incidentDate: '2026-02-10',
          description: 'Suitcase did not arrive at the destination airport.',
          amountClaimed: 800,
        },
        now,
      },
    ])

    expect(state.claims).toHaveLength(0)
  })

  it('clears everything on reset', () => {
    const state = run([
      { type: 'quote/created', id: 'q1', input: quoteInput, now },
      { type: 'state/reset' },
    ])

    expect(state).toEqual(emptyState)
  })
})

describe('persistence', () => {
  it('round trips through storage', () => {
    const state = run([{ type: 'quote/created', id: 'q1', input: quoteInput, now }])
    saveState(state, localStorage)

    expect(loadState(localStorage)).toEqual(state)
  })

  it('falls back to an empty state when the stored data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    expect(loadState(localStorage)).toEqual(emptyState)
  })

  it('drops invalid persisted items and sequences', () => {
    const state = run([{ type: 'quote/created', id: 'q1', input: quoteInput, now }])
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        quotes: [state.quotes[0], 'not a quote'],
        policies: [42],
        claims: [null],
        sequences: { quote: Number.NaN, policy: 1, claim: Number.POSITIVE_INFINITY },
      }),
    )

    expect(loadState(localStorage)).toEqual({
      quotes: state.quotes,
      policies: [],
      claims: [],
      sequences: { quote: 0, policy: 1, claim: 0 },
    })
  })

  it('falls back to an empty state when storage is unavailable', () => {
    expect(loadState(undefined)).toEqual(emptyState)
  })
})
