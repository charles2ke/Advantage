import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddressLookupField } from '../src/components/AddressLookupField'
import { CurrencyConverter } from '../src/components/CurrencyConverter'
import { AppProvider } from '../src/state/AppProvider'
import { defaultSettings } from '../src/domain/settings'
import { STORAGE_KEY, emptyState } from '../src/state/storage'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubGlobalFetch(response: Response) {
  const fetcher = vi.fn(async () => response)
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('address lookup field', () => {
  it('shows the district and region for a verified postcode', async () => {
    stubGlobalFetch(
      jsonResponse({
        result: {
          postcode: 'SW1A 2AA',
          country: 'England',
          region: 'London',
          admin_district: 'Westminster',
          latitude: 51.5,
          longitude: -0.12,
        },
      }),
    )
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AppProvider>
        <AddressLookupField value="sw1a 2aa" onChange={onChange} />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: /check postcode/i }))

    expect(await screen.findByTestId('address-result')).toHaveTextContent('Westminster')
    expect(onChange).toHaveBeenCalledWith('SW1A 2AA')
  })

  it('lets the customer continue when the service fails', async () => {
    stubGlobalFetch(jsonResponse({}, 500))
    const user = userEvent.setup()
    render(
      <AppProvider>
        <AddressLookupField value="SW1A 2AA" onChange={vi.fn()} />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: /check postcode/i }))

    expect(await screen.findByTestId('address-error')).toHaveTextContent(/still continue/i)
  })

  it('hides the lookup when the integration is turned off', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...emptyState,
        settings: {
          ...defaultSettings,
          integrations: {
            ...defaultSettings.integrations,
            addressLookup: { enabled: false, baseUrl: 'https://api.postcodes.io' },
          },
        },
      }),
    )
    render(
      <AppProvider>
        <AddressLookupField value="" onChange={vi.fn()} />
      </AppProvider>,
    )

    expect(screen.queryByRole('button', { name: /check postcode/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/postcode/i)).toBeInTheDocument()
  })
})

describe('currency converter', () => {
  it('converts the price with the published rate', async () => {
    stubGlobalFetch(jsonResponse({ base: 'GBP', date: '2026-09-14', rates: { EUR: 1.2 } }))
    const user = userEvent.setup()
    render(
      <AppProvider>
        <CurrencyConverter amount={500} />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: /convert/i }))

    expect(await screen.findByTestId('converted-premium')).toHaveTextContent('600.00')
  })

  it('reports a failure without breaking the quote', async () => {
    stubGlobalFetch(jsonResponse({}, 503))
    const user = userEvent.setup()
    render(
      <AppProvider>
        <CurrencyConverter amount={500} />
      </AppProvider>,
    )

    await user.click(screen.getByRole('button', { name: /convert/i }))

    expect(await screen.findByTestId('conversion-error')).toHaveTextContent(/503/)
  })
})
