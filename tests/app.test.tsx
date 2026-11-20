import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { formatCurrency } from '../src/domain/format'
import type { Applicant, QuoteInput } from '../src/domain/types'
import { appReducer, type AppAction } from '../src/state/appReducer'
import { AppProvider } from '../src/state/AppProvider'
import { createBackup } from '../src/state/backup'
import { emptyState, saveState, STORAGE_KEY, type AppState } from '../src/state/storage'

const today = new Date().toISOString().slice(0, 10)
const DAY = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString()
}

function motorInput(applicant: Partial<Applicant> = {}): QuoteInput {
  return {
    productId: 'auto',
    applicant: {
      fullName: 'Alex Turner',
      email: 'alex@example.com',
      dateOfBirth: '1986-01-01',
      postcode: 'M1 2AB',
      ...applicant,
    },
    sumInsured: 20000,
    excess: 500,
    coverageIds: [],
    riskAnswers: { usage: 'social', claims: 'none', parking: 'driveway' },
    existingPolicies: 0,
  }
}

function buyPolicy(id: string, when: string, applicant?: Partial<Applicant>): AppAction[] {
  return [
    { type: 'quote/created', id: `quote-${id}`, input: motorInput(applicant), now: when },
    { type: 'quote/accepted', id, quoteId: `quote-${id}`, now: when },
  ]
}

function makeClaim(id: string, amountClaimed: number): AppAction {
  return {
    type: 'claim/created',
    id,
    input: {
      policyNumber: 'ADV-AUTO-000001',
      incidentDate: daysAgo(2).slice(0, 10),
      description: 'Rear ended at a set of traffic lights on the ring road.',
      amountClaimed,
    },
    now: new Date().toISOString(),
  }
}

function buildState(actions: AppAction[]): AppState {
  return actions.reduce(appReducer, emptyState)
}

/** Stores the data the app starts with and opens it on the given page. */
function seed(actions: AppAction[], path = '/'): AppState {
  const state = buildState(actions)
  saveState(state, localStorage)
  window.location.hash = path
  return state
}

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  )
}

async function buyMotorPolicy(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /get a quote/i })[0])
  await user.click(screen.getByRole('button', { name: /quote motor insurance/i }))

  await user.type(screen.getByLabelText(/full name/i), 'Alex Turner')
  await user.type(screen.getByLabelText(/email address/i), 'alex@example.com')
  await user.type(screen.getByLabelText(/date of birth/i), '1986-01-01')
  await user.type(screen.getByLabelText(/postcode/i), 'M1 2AB')
  await user.click(screen.getByRole('button', { name: /continue to cover/i }))

  await user.selectOptions(screen.getByLabelText(/how is the vehicle used/i), 'social')
  await user.selectOptions(screen.getByLabelText(/claims in the last 5 years/i), 'none')
  await user.selectOptions(screen.getByLabelText(/overnight parking/i), 'driveway')
  await user.click(screen.getByRole('button', { name: /see my price/i }))
  await user.click(screen.getByRole('button', { name: /buy this policy/i }))
}

describe('Advantage platform', () => {
  it('shows the product catalogue on the homepage', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: /insurance that works/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Motor insurance' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Travel insurance' })).toBeInTheDocument()
  })

  it('blocks the quote journey until the applicant details are valid', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getAllByRole('button', { name: /get a quote/i })[0])
    await user.click(screen.getByRole('button', { name: /quote home insurance/i }))
    await user.click(screen.getByRole('button', { name: /continue to cover/i }))

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText(/enter the name of the person/i)).toBeInTheDocument()
    expect(within(alert).getByText(/enter a valid email address/i)).toBeInTheDocument()
    expect(alert).toHaveFocus()
  })

  it('moves focus to the main content from the skip link', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: /skip to main content/i }))

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('names the page in the document title', async () => {
    const user = userEvent.setup()
    renderApp()

    expect(document.title).toBe('Home — Advantage')

    await user.click(screen.getAllByRole('button', { name: /get a quote/i })[0])

    expect(document.title).toBe('Get a quote — Advantage')
  })

  it('lets you step back to a completed step of the quote wizard', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getAllByRole('button', { name: /get a quote/i })[0])
    await user.click(screen.getByRole('button', { name: /quote home insurance/i }))

    await user.type(screen.getByLabelText(/full name/i), 'Alex Turner')
    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/date of birth/i), '1986-01-01')
    await user.type(screen.getByLabelText(/postcode/i), 'M1 2AB')
    await user.click(screen.getByRole('button', { name: /continue to cover/i }))

    expect(screen.getByRole('heading', { name: /choose your cover/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /your details.*completed/i }))

    expect(screen.getByRole('heading', { name: /about you/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Alex Turner')
  })

  it('prevents stepping back after buying a policy', async () => {
    const user = userEvent.setup()
    renderApp()

    await buyMotorPolicy(user)

    expect(screen.queryByRole('button', { name: /completed, go back/i })).not.toBeInTheDocument()
  })

  it('quotes, buys and then claims on a policy', async () => {
    const user = userEvent.setup()
    renderApp()

    await buyMotorPolicy(user)
    expect(screen.getByText(/is now active/i)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /policies/i }))
    expect(screen.getByText(/ADV-AUTO-000001/)).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: /claims/i }))
    await user.selectOptions(screen.getByLabelText(/policy/i), 'ADV-AUTO-000001')
    await user.type(screen.getByLabelText(/date of the incident/i), today)
    await user.type(
      screen.getByLabelText(/what happened/i),
      'Rear ended at a set of traffic lights on the ring road.',
    )
    await user.type(screen.getByLabelText(/amount claimed/i), '2400')
    await user.click(screen.getByRole('button', { name: /submit claim/i }))

    expect(screen.getByText(/CLM-000001 submitted/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark as in review/i })).toBeInTheDocument()
  })

  it('rejects a claim that is older than the policy', async () => {
    const user = userEvent.setup()
    renderApp()

    await buyMotorPolicy(user)
    await user.click(screen.getByRole('link', { name: /claims/i }))

    await user.selectOptions(screen.getByLabelText(/policy/i), 'ADV-AUTO-000001')
    await user.type(screen.getByLabelText(/date of the incident/i), '2020-02-02')
    await user.type(
      screen.getByLabelText(/what happened/i),
      'Rear ended at a set of traffic lights on the ring road.',
    )
    await user.type(screen.getByLabelText(/amount claimed/i), '2400')
    await user.click(screen.getByRole('button', { name: /submit claim/i }))

    expect(screen.getByText(/before the policy started/i)).toBeInTheDocument()
  })

  it('sets the platform up from the admin portal', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: /admin/i }))
    expect(screen.getByRole('heading', { name: /admin portal/i })).toBeInTheDocument()

    const brandName = screen.getByLabelText(/platform name/i)
    await user.clear(brandName)
    await user.type(brandName, 'Northwind Cover')
    await user.click(screen.getByRole('checkbox', { name: /travel insurance/i }))
    await user.click(screen.getByRole('button', { name: /save settings/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/settings saved/i)
    expect(screen.getByRole('banner')).toHaveTextContent('Northwind Cover')

    await user.click(screen.getByRole('link', { name: /home/i }))
    expect(screen.queryByRole('heading', { name: 'Travel insurance' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Motor insurance' })).toBeInTheDocument()
  })

  it('reports invalid platform settings', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('link', { name: /admin/i }))
    await user.clear(screen.getByLabelText(/support email/i))
    await user.click(screen.getByRole('button', { name: /save settings/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/valid support email/i)
  })
})

describe('Returning customers', () => {
  it('fills in the details from the last quote, which can be cleared', async () => {
    const user = userEvent.setup()
    seed(buyPolicy('p1', daysAgo(10)), '/quote/home')
    renderApp()

    expect(screen.getByText(/filled in your details from your last quote/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Alex Turner')

    await user.click(screen.getByRole('button', { name: /clear my details/i }))

    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
    expect(screen.getByLabelText(/full name/i)).toHaveFocus()
    expect(screen.queryByText(/filled in your details/i)).not.toBeInTheDocument()
  })

  it('describes the platform with its configured name and loyalty discount', () => {
    seed([
      {
        type: 'settings/updated',
        settings: { ...emptyState.settings, brandName: 'Northwind Cover', maxLoyaltyDiscount: 0.1 },
      },
    ])
    renderApp()

    expect(screen.getByRole('heading', { name: 'Why Northwind Cover' })).toBeInTheDocument()
    expect(screen.getByText('Up to 10% loyalty discount across your policies')).toBeInTheDocument()
  })
})

describe('Managing policies', () => {
  it('offers a new quote in place of an expired one, and lets you discard it', async () => {
    const user = userEvent.setup()
    seed([{ type: 'quote/created', id: 'q1', input: motorInput(), now: daysAgo(40) }], '/policies')
    renderApp()

    const quote = screen.getByRole('article')
    expect(within(quote).getByText('Expired')).toBeInTheDocument()
    expect(within(quote).queryByRole('button', { name: /buy this policy/i })).not.toBeInTheDocument()
    expect(within(quote).getByRole('button', { name: /get a new quote/i })).toBeInTheDocument()

    await user.click(within(quote).getByRole('button', { name: /discard quote/i }))

    expect(screen.getByText(/no saved quotes/i)).toBeInTheDocument()
  })

  it('finds a policy by policyholder, postcode or policy number', async () => {
    const user = userEvent.setup()
    seed(
      [
        ...buyPolicy('p1', daysAgo(10)),
        ...buyPolicy('p2', daysAgo(5), { fullName: 'Tom Reed', postcode: 'LS2 7EY' }),
      ],
      '/policies',
    )
    renderApp()

    const search = screen.getByRole('searchbox', { name: /search/i })
    await user.type(search, 'ls2')

    expect(screen.getByText(/showing 1 of 2 policies/i)).toBeInTheDocument()
    expect(screen.getByText('ADV-AUTO-000002')).toBeInTheDocument()
    expect(screen.queryByText('ADV-AUTO-000001')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nobody')
    await user.click(screen.getByRole('button', { name: /show all policies/i }))

    expect(screen.getByText(/showing 2 of 2 policies/i)).toBeInTheDocument()
  })

  it('shows the new price before a policy is renewed', async () => {
    const user = userEvent.setup()
    const state = seed(
      [
        ...buyPolicy('p1', daysAgo(350)),
        { type: 'settings/updated', settings: { ...emptyState.settings, taxRate: 0.2 } },
      ],
      '/policies',
    )
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Renew' }))

    expect(screen.getByRole('group', { name: /confirm renewal/i })).toHaveFocus()
    expect(screen.getByTestId('renewal-price')).toHaveTextContent(
      `up from ${formatCurrency(state.policies[0].premium.total)}`,
    )

    await user.click(screen.getByRole('button', { name: /confirm renewal/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/renewed\. your cover now runs until/i)
  })

  it('shows the refund before a policy is cancelled', async () => {
    const user = userEvent.setup()
    seed(buyPolicy('p1', daysAgo(100)), '/policies')
    renderApp()

    const cancel = screen.getByRole('button', { name: /cancel policy/i })
    await user.click(cancel)
    const confirm = screen.getByRole('group', { name: /confirm cancellation/i })

    expect(confirm).toHaveFocus()
    expect(confirm).toHaveTextContent(/you will be refunded £[\d,]+\.\d{2} for the unused part/i)

    await user.click(within(confirm).getByRole('button', { name: /keep policy/i }))
    expect(cancel).toHaveFocus()

    await user.click(cancel)
    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect(screen.getByRole('status')).toHaveTextContent(
      /policy cancelled\. a refund of £[\d,]+\.\d{2} will be paid to you/i,
    )
    expect(screen.queryByRole('button', { name: /cancel policy/i })).not.toBeInTheDocument()
  })

  it('keeps a cancelled policy in view until the search changes', async () => {
    const user = userEvent.setup()
    seed([...buyPolicy('p1', daysAgo(20)), ...buyPolicy('p2', daysAgo(10))], '/policies')
    renderApp()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'active')
    const [card] = screen.getAllByRole('article')
    expect(card).toHaveTextContent('ADV-AUTO-000002')

    await user.click(within(card).getByRole('button', { name: /cancel policy/i }))
    await user.click(screen.getByRole('button', { name: /yes, cancel/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/policy cancelled/i)
    expect(screen.getByRole('status')).toHaveFocus()
    expect(screen.getByText(/showing 2 of 2 policies/i)).toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'adv')

    expect(screen.getByText(/showing 1 of 2 policies/i)).toBeInTheDocument()
    expect(screen.queryByText('ADV-AUTO-000002')).not.toBeInTheDocument()
  })

  it('shows a printable policy schedule with the claims made', async () => {
    const user = userEvent.setup()
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    seed([...buyPolicy('p1', daysAgo(10)), makeClaim('c1', 2400)], '/policies')
    renderApp()

    await user.click(screen.getByRole('button', { name: /policy schedule/i }))

    expect(screen.getByRole('heading', { level: 1, name: /policy schedule/i })).toBeInTheDocument()
    expect(document.title).toBe('Policy schedule ADV-AUTO-000001 — Advantage')
    expect(within(screen.getByRole('table')).getByText('CLM-000001')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /print or save as pdf/i }))

    expect(print).toHaveBeenCalledOnce()
    print.mockRestore()
  })
})

describe('Handling claims', () => {
  it('filters claims by status and adds handler notes to the timeline', async () => {
    const user = userEvent.setup()
    seed(
      [
        ...buyPolicy('p1', daysAgo(30)),
        makeClaim('c1', 400),
        makeClaim('c2', 600),
        {
          type: 'claim/advanced',
          claimId: 'c1',
          status: 'declined',
          note: 'Not covered by the policy.',
          now: new Date().toISOString(),
        },
      ],
      '/claims',
    )
    renderApp()

    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'declined')

    expect(screen.getByText('CLM-000001')).toBeInTheDocument()
    expect(screen.queryByText('CLM-000002')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/filter by status/i), 'open')
    await user.type(screen.getByLabelText(/handler note/i), 'Photos of the damage received.')
    await user.click(screen.getByRole('button', { name: /mark as in review/i }))

    const timeline = screen.getAllByRole('listitem').map((item) => item.textContent)
    expect(timeline).toContainEqual(expect.stringMatching(/^In review.*Photos of the damage received\.$/))
  })
})

describe('Keeping data safe', () => {
  it('shows changes made in another tab', () => {
    window.location.hash = '/policies'
    renderApp()
    expect(screen.getByText(/you do not have any policies yet/i)).toBeInTheDocument()

    saveState(buildState(buyPolicy('p1', daysAgo(1))), localStorage)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })

    expect(screen.getByText('ADV-AUTO-000001')).toBeInTheDocument()
  })

  it('restores a backup after showing what it contains', async () => {
    const user = userEvent.setup()
    window.location.hash = '/admin'
    renderApp()
    const backup = createBackup(
      buildState(buyPolicy('p1', daysAgo(1))),
      new Date('2026-03-01T09:30:00.000Z'),
    )
    const input = screen.getByLabelText(/restore from a backup file/i)

    await user.upload(input, new File(['not a backup'], 'notes.json', { type: 'application/json' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/notes\.json cannot be restored/i)

    await user.upload(input, new File([backup], 'backup.json', { type: 'application/json' }))
    let confirm = await screen.findByRole('group', { name: /confirm restore/i })

    expect(confirm).toHaveTextContent(
      'backup.json, backed up on 01 Mar 2026, contains 1 quote, 1 policy and 0 claims.',
    )

    await user.click(within(confirm).getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('group', { name: /confirm restore/i })).not.toBeInTheDocument()
    expect(input).toHaveFocus()

    await user.upload(input, new File([backup], 'backup.json', { type: 'application/json' }))
    confirm = await screen.findByRole('group', { name: /confirm restore/i })
    await user.click(within(confirm).getByRole('button', { name: /restore this backup/i }))

    expect(screen.getByRole('status')).toHaveTextContent(/backup restored/i)
    expect(screen.getByRole('status')).toHaveFocus()

    await user.click(screen.getByRole('link', { name: /policies/i }))

    expect(screen.getByText('ADV-AUTO-000001')).toBeInTheDocument()
  })
})
