import { useState } from 'react'
import { lookupPostcode, type AddressDetails } from '../integrations/addressLookup'
import { integrationBaseUrl, isIntegrationEnabled } from '../domain/settings'
import { useApp } from '../state/AppContext'

interface AddressLookupFieldProps {
  value: string
  onChange: (postcode: string) => void
}

/**
 * Postcode field backed by the address lookup integration. The lookup is a help
 * rather than a gate: if the service is off or unreachable the customer can
 * still type a postcode and carry on.
 */
export function AddressLookupField({ value, onChange }: AddressLookupFieldProps) {
  const { state } = useApp()
  const enabled = isIntegrationEnabled(state.settings, 'addressLookup')
  const [busy, setBusy] = useState(false)
  const [address, setAddress] = useState<AddressDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setBusy(true)
    setError(null)
    setAddress(null)
    const result = await lookupPostcode(value, {
      baseUrl: integrationBaseUrl(state.settings, 'addressLookup'),
    })
    if (result.ok) {
      setAddress(result.data)
      onChange(result.data.postcode)
    } else {
      setError(result.error)
    }
    setBusy(false)
  }

  return (
    <div className="field">
      <label htmlFor="postcode">Postcode</label>
      <input
        id="postcode"
        type="text"
        autoComplete="postal-code"
        value={value}
        disabled={busy}
        onChange={(event) => {
          onChange(event.target.value)
          setAddress(null)
          setError(null)
        }}
      />
      {enabled && (
        <>
          <div className="button-row">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void check()
              }}
              disabled={busy}
            >
              {busy ? 'Checking…' : 'Check postcode'}
            </button>
          </div>
          <span className="field__help">
            We check the postcode against the Ordnance Survey and ONS open data held by
            postcodes.io.
          </span>
        </>
      )}
      {address && (
        <p className="field__help" role="status" data-testid="address-result">
          {address.postcode} — {address.district}, {address.region}, {address.country}
        </p>
      )}
      {error && (
        <p className="field__help" role="status" data-testid="address-error">
          {error} You can still continue with the postcode you entered.
        </p>
      )}
    </div>
  )
}
