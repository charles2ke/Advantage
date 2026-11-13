import { describe, expect, it, vi } from 'vitest'
import { appReducer, type AppAction } from '../src/state/appReducer'
import { emptyState, loadState, saveState, STORAGE_KEY, type AppState } from '../src/state/storage'
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

function run(actions: AppAction[], from: AppState = emptyState) {
  return actions.reduce(appReducer, from)
}

const issued: AppAction[] = [
  { type: 'quote/created', id: 'q1', input: quoteInput, now },
  { type: 'quote/accepted', id: 'p1', quoteId: 'q1', now },
]

function claimFor(id: string, amountClaimed: number): AppAction {
  return {
    type: 'claim/created',
    id,
    input: {
      policyNumber: 'ADV-TRAVEL-000001',
      incidentDate: '2026-02-10',
      description: 'Suitcase did not arrive at the destination airport.',
      amountClaimed,
    },
    now: '2026-02-11T00:00:00.000Z',
  }
}

function advance(status: 'in_review' | 'approved' | 'settled'): AppAction {
  return { type: 'claim/advanced', claimId: 'c1', status, note: 'Next step.', now: '2026-02-12T00:00:00.000Z' }
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

  it('does not issue a policy from an expired quote or a product taken off sale', () => {
    const quoted = run([{ type: 'quote/created', id: 'q1', input: quoteInput, now }])
    const offSale = run([
      {
        type: 'settings/updated',
        settings: {
          ...quoted.settings,
          enabledProducts: quoted.settings.enabledProducts.filter((id) => id !== 'travel'),
        },
      },
    ], quoted)
    const accept = (when: string): AppAction => ({
      type: 'quote/accepted',
      id: 'p1',
      quoteId: 'q1',
      now: when,
    })

    expect(appReducer(quoted, accept('2026-02-01T00:00:00.000Z'))).toBe(quoted)
    expect(appReducer(offSale, accept(now))).toBe(offSale)
  })

  it('discards a saved quote but keeps the quote behind a policy', () => {
    const state = run([
      { type: 'quote/created', id: 'q2', input: quoteInput, now },
      ...issued,
      { type: 'quote/discarded', quoteId: 'q1' },
      { type: 'quote/discarded', quoteId: 'q2' },
    ])

    expect(state.quotes.map((quote) => quote.id)).toEqual(['q1'])
  })

  it('cancels a policy, recording the date and the refund', () => {
    const state = run([...issued, { type: 'policy/cancelled', policyId: 'p1', now }])

    expect(state.policies[0]).toMatchObject({
      status: 'cancelled',
      cancelledAt: now,
      refund: state.policies[0].premium.total,
    })
  })

  it('renews a policy at the price worked out with the current settings', () => {
    const state = run(issued)
    const renewed = run([
      { type: 'settings/updated', settings: { ...state.settings, taxRate: 0.2 } },
      { type: 'policy/renewed', policyId: 'p1', now: '2026-12-20T00:00:00.000Z' },
    ], state).policies[0]

    expect(renewed.startDate).toBe(state.policies[0].endDate)
    expect(renewed.premium.tax).toBeGreaterThan(state.policies[0].premium.tax)
  })

  it('does not renew a policy before renewal opens', () => {
    const state = run(issued)
    expect(
      appReducer(state, { type: 'policy/renewed', policyId: 'p1', now: '2026-06-01T00:00:00.000Z' }),
    ).toBe(state)
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

  it('refuses a claim for more than is left of the sum insured', () => {
    const state = run([...issued, claimFor('c1', 3000), claimFor('c2', 3000)])

    expect(state.claims.map((claim) => claim.id)).toEqual(['c1'])
    expect(state.sequences.claim).toBe(1)
  })

  it('ignores a claim step that is not allowed', () => {
    const state = run([...issued, claimFor('c1', 800)])
    expect(appReducer(state, advance('settled'))).toBe(state)
  })

  it('records the amount paid when a claim is settled', () => {
    const state = run([
      ...issued,
      claimFor('c1', 800),
      advance('in_review'),
      advance('approved'),
      advance('settled'),
    ])

    // £800 claimed less the £75 excess.
    expect(state.claims[0]).toMatchObject({ status: 'settled', settledAmount: 725 })
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

  it('drops invalid persisted items and repairs the sequences', () => {
    const state = run([{ type: 'quote/created', id: 'q1', input: quoteInput, now }])
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...state,
        quotes: [state.quotes[0], 'not a quote'],
        policies: [42],
        claims: [null],
        sequences: { quote: Number.NaN, policy: 1, claim: Number.MAX_SAFE_INTEGER + 1 },
      }),
    )

    expect(loadState(localStorage)).toEqual({
      settings: state.settings,
      quotes: state.quotes,
      policies: [],
      claims: [],
      // The stored quote counter is invalid, so it restarts after the quote already issued.
      sequences: { quote: 1, policy: 1, claim: 0 },
    })
  })

  it('never hands out a reference that is already in use', () => {
    const state = run([...issued, claimFor('c1', 800)])
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, sequences: { quote: 0, policy: 0, claim: 0 } }),
    )

    const next = run(
      [
        { type: 'quote/created', id: 'q2', input: quoteInput, now },
        { type: 'quote/accepted', id: 'p2', quoteId: 'q2', now },
        claimFor('c2', 800),
      ],
      loadState(localStorage),
    )

    expect(next.quotes[0].reference).toBe('QT-TRAVEL-00002')
    expect(next.policies[0].policyNumber).toBe('ADV-TRAVEL-000002')
    expect(next.claims[0].reference).toBe('CLM-000002')
  })

  it('fills in the risk answers of a policy saved by an earlier version', () => {
    const state = run(issued)
    const legacy: Record<string, unknown> = { ...state.policies[0] }
    delete legacy.riskAnswers

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, policies: [legacy] }))
    expect(loadState(localStorage).policies[0].riskAnswers).toEqual(quoteInput.riskAnswers)

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, quotes: [], policies: [legacy] }))
    expect(loadState(localStorage).policies[0].riskAnswers).toEqual({})
  })

  it('does not write to storage when nothing has changed', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value)
      }),
    } as unknown as Storage
    const state = run(issued)

    saveState(state, storage)
    saveState(state, storage)

    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('falls back to an empty state when storage is unavailable', () => {
    expect(loadState(undefined)).toEqual(emptyState)
  })
})
