import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { App } from '../src/App'
import { AppProvider } from '../src/state/AppProvider'

const today = new Date().toISOString().slice(0, 10)

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
