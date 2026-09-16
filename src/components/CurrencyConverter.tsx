import { useState } from 'react'
import { integrationBaseUrl, isIntegrationEnabled } from '../domain/settings'
import {
  convert,
  fetchExchangeRate,
  formatInCurrency,
  supportedCurrencies,
  type ExchangeRate,
} from '../integrations/exchangeRates'
import { useApp } from '../state/AppContext'

/**
 * Shows the price of a quote in another currency using the published European
 * Central Bank reference rates. The conversion is indicative: the policy is
 * always paid for in the platform's base currency.
 */
export function CurrencyConverter({ amount }: { amount: number }) {
  const { state } = useApp()
  const [currency, setCurrency] = useState(supportedCurrencies[0].code as string)
  const [busy, setBusy] = useState(false)
  const [rate, setRate] = useState<ExchangeRate | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isIntegrationEnabled(state.settings, 'exchangeRates')) {
    return null
  }

  async function load(target: string) {
    setBusy(true)
    setError(null)
    setRate(null)
    const result = await fetchExchangeRate(target, {
      baseUrl: integrationBaseUrl(state.settings, 'exchangeRates'),
    })
    if (result.ok) {
      setRate(result.data)
    } else {
      setError(result.error)
    }
    setBusy(false)
  }

  return (
    <div className="field">
      <label htmlFor="quote-currency">Show this price in another currency</label>
      <select
        id="quote-currency"
        value={currency}
        disabled={busy}
        onChange={(event) => {
          setCurrency(event.target.value)
          setRate(null)
          setError(null)
        }}
      >
        {supportedCurrencies.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code} — {option.name}
          </option>
        ))}
      </select>
      <div className="button-row">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => {
            void load(currency)
          }}
          disabled={busy}
        >
          {busy ? 'Converting…' : 'Convert'}
        </button>
      </div>
      {rate && (
        <p className="field__help" role="status" data-testid="converted-premium">
          About {formatInCurrency(convert(amount, rate), rate.target)} — European Central Bank rate
          of {rate.rate} published on {rate.date}. You pay in {rate.base}.
        </p>
      )}
      {error && (
        <p className="field__help" role="status" data-testid="conversion-error">
          {error}
        </p>
      )}
    </div>
  )
}
