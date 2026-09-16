import { useState } from 'react'
import { products } from '../domain/catalog'
import { formatCurrency } from '../domain/format'
import {
  defaultSettings,
  validateSettings,
  type IntegrationSetting,
  type PlatformSettings,
} from '../domain/settings'
import { integrationCatalog, type IntegrationId } from '../integrations/catalog'
import type { ProductId } from '../domain/types'
import { useApp } from '../state/AppContext'

function toPercent(rate: number): string {
  return (Math.round(rate * 10000) / 100).toString()
}

function fromPercent(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed / 100 : Number.NaN
}

export function AdminPage() {
  const { state, dispatch } = useApp()
  const [draft, setDraft] = useState<PlatformSettings>(state.settings)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [checking, setChecking] = useState<IntegrationId | null>(null)
  const [checks, setChecks] = useState<Record<string, { ok: boolean; message: string }>>({})

  function update(patch: Partial<PlatformSettings>) {
    setDraft((current) => ({ ...current, ...patch }))
    setSaved(false)
  }

  function toggleProduct(productId: ProductId) {
    update({
      enabledProducts: draft.enabledProducts.includes(productId)
        ? draft.enabledProducts.filter((id) => id !== productId)
        : [...draft.enabledProducts, productId],
    })
  }

  function updateIntegration(id: IntegrationId, patch: Partial<IntegrationSetting>) {
    update({
      integrations: {
        ...draft.integrations,
        [id]: { ...draft.integrations[id], ...patch },
      },
    })
    setChecks((current) => {
      const { [id]: _removed, ...rest } = current
      return rest
    })
  }

  async function testIntegration(id: IntegrationId) {
    const integration = integrationCatalog.find((candidate) => candidate.id === id)
    if (!integration) {
      return
    }
    setChecking(id)
    const result = await integration.check({ baseUrl: draft.integrations[id].baseUrl })
    setChecks((current) => ({
      ...current,
      [id]: result.ok
        ? { ok: true, message: result.data }
        : { ok: false, message: result.error },
    }))
    setChecking(null)
  }

  function save() {
    const settings = {
      ...draft,
      brandName: draft.brandName.trim(),
      supportEmail: draft.supportEmail.trim(),
    }
    const found = validateSettings(settings)
    setErrors(found)
    if (found.length > 0) {
      setSaved(false)
      return
    }
    dispatch({ type: 'settings/updated', settings })
    setSaved(true)
  }

  function restoreDefaults() {
    setDraft(defaultSettings)
    setErrors([])
    dispatch({ type: 'settings/reset' })
    setSaved(true)
  }

  function clearData() {
    dispatch({ type: 'state/reset' })
    setConfirmingReset(false)
  }

  const annualPremium = state.policies.reduce((total, policy) => total + policy.premium.total, 0)

  return (
    <section className="page">
      <header className="page__header" role="group" aria-labelledby="admin-page-title">
        <h1 id="admin-page-title">Admin portal</h1>
        <p>
          Set the platform up: name it, choose the products you sell and tune the pricing rules that
          every quote is rated with.
        </p>
      </header>

      <section className="section">
        <h2>Platform at a glance</h2>
        <div className="grid grid--stats">
          <div className="stat">
            <div className="stat__value">{draft.enabledProducts.length}</div>
            <div className="stat__label">Products on sale</div>
          </div>
          <div className="stat">
            <div className="stat__value">{state.quotes.length}</div>
            <div className="stat__label">Quotes issued</div>
          </div>
          <div className="stat">
            <div className="stat__value">{state.policies.length}</div>
            <div className="stat__label">Policies</div>
          </div>
          <div className="stat">
            <div className="stat__value">{formatCurrency(annualPremium)}</div>
            <div className="stat__label">Premium written</div>
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="alert alert--error" role="alert">
          <strong>These settings could not be saved</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {saved && (
        <div className="alert alert--success" role="status">
          Settings saved. New quotes use them straight away.
        </div>
      )}

      <div className="grid grid--two">
        <section className="card">
          <h2>Branding</h2>
          <div className="field">
            <label htmlFor="brandName">Platform name</label>
            <input
              id="brandName"
              type="text"
              value={draft.brandName}
              onChange={(event) => update({ brandName: event.target.value })}
            />
            <span className="field__help">Shown in the header and the footer.</span>
          </div>
          <div className="field">
            <label htmlFor="supportEmail">Support email</label>
            <input
              id="supportEmail"
              type="email"
              value={draft.supportEmail}
              onChange={(event) => update({ supportEmail: event.target.value })}
            />
            <span className="field__help">Where customers are told to go for help.</span>
          </div>
        </section>

        <section className="card">
          <h2>Products on sale</h2>
          <p className="field__help">
            Only the products selected here can be quoted and bought. Existing policies are not
            affected.
          </p>
          {products.map((product) => (
            <label className="checkbox-option" key={product.id}>
              <input
                type="checkbox"
                checked={draft.enabledProducts.includes(product.id)}
                onChange={() => toggleProduct(product.id)}
              />
              <span className="checkbox-option__text">
                <strong>{product.name}</strong>
                <span className="field__help">{product.tagline}</span>
              </span>
            </label>
          ))}
        </section>
      </div>

      <section className="section">
        <h2>Pricing rules</h2>
        <div className="grid grid--two">
          <div className="card">
            <div className="field">
              <label htmlFor="taxRate">Insurance premium tax (%)</label>
              <input
                id="taxRate"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={toPercent(draft.taxRate)}
                onChange={(event) => update({ taxRate: fromPercent(event.target.value) })}
              />
            </div>
            <div className="field">
              <label htmlFor="monthlyLoading">Monthly instalment loading (%)</label>
              <input
                id="monthlyLoading"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={toPercent(draft.monthlyLoading)}
                onChange={(event) => update({ monthlyLoading: fromPercent(event.target.value) })}
              />
            </div>
          </div>
          <div className="card">
            <div className="field">
              <label htmlFor="loyaltyDiscountPerPolicy">Loyalty discount per policy (%)</label>
              <input
                id="loyaltyDiscountPerPolicy"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={toPercent(draft.loyaltyDiscountPerPolicy)}
                onChange={(event) =>
                  update({ loyaltyDiscountPerPolicy: fromPercent(event.target.value) })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="maxLoyaltyDiscount">Maximum loyalty discount (%)</label>
              <input
                id="maxLoyaltyDiscount"
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={toPercent(draft.maxLoyaltyDiscount)}
                onChange={(event) =>
                  update({ maxLoyaltyDiscount: fromPercent(event.target.value) })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="quoteValidityDays">Quote validity (days)</label>
              <input
                id="quoteValidityDays"
                type="number"
                min={1}
                max={365}
                step={1}
                value={draft.quoteValidityDays}
                onChange={(event) =>
                  update({ quoteValidityDays: Number(event.target.value) })
                }
              />
            </div>
          </div>
        </div>
        <div className="button-row">
          <button type="button" className="button" onClick={save}>
            Save settings
          </button>
          <button type="button" className="button button--secondary" onClick={restoreDefaults}>
            Restore defaults
          </button>
          <span className="field__help">Restoring the defaults saves them straight away.</span>
        </div>
      </section>

      <section className="section">
        <h2>Integrations</h2>
        <p className="field__help">
          Advantage calls these public services live from the browser. Turn one off to run the
          platform without it, or point it at your own endpoint or proxy.
        </p>
        <div className="grid grid--two">
          {integrationCatalog.map((integration) => {
            const config = draft.integrations[integration.id]
            const check = checks[integration.id]
            return (
              <section className="card" key={integration.id}>
                <h3>{integration.name}</h3>
                <p className="field__help">{integration.description}</p>
                <p className="field__help">
                  Data from {integration.provider} —{' '}
                  <a href={integration.docsUrl} target="_blank" rel="noreferrer noopener">
                    API documentation
                  </a>
                </p>
                <label className="checkbox-option">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={() => updateIntegration(integration.id, { enabled: !config.enabled })}
                  />
                  <span className="checkbox-option__text">
                    <strong>Enabled</strong>
                  </span>
                </label>
                <div className="field">
                  <label htmlFor={`integration-${integration.id}`}>Endpoint</label>
                  <input
                    id={`integration-${integration.id}`}
                    type="url"
                    value={config.baseUrl}
                    onChange={(event) =>
                      updateIntegration(integration.id, { baseUrl: event.target.value })
                    }
                  />
                  <span className="field__help">
                    Default: {integration.defaultBaseUrl}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={checking === integration.id}
                    onClick={() => {
                      void testIntegration(integration.id)
                    }}
                  >
                    {checking === integration.id ? 'Testing…' : 'Test connection'}
                  </button>
                </div>
                {check && (
                  <p
                    className="field__help"
                    role="status"
                    data-testid={`check-${integration.id}`}
                  >
                    {check.ok ? 'Connected. ' : 'Not connected. '}
                    {check.message}
                  </p>
                )}
              </section>
            )
          })}
        </div>
        <div className="button-row">
          <button type="button" className="button" onClick={save}>
            Save integrations
          </button>
        </div>
      </section>

      <section className="section">
        <h2>Data</h2>
        <div className="card">
          <p className="field__help">
            Clearing the data removes every quote, policy and claim stored in this browser. The
            platform settings above are kept.
          </p>
          <div className="button-row">
            {confirmingReset ? (
              <>
                <span className="field__help">This cannot be undone.</span>
                <button type="button" className="button button--danger" onClick={clearData}>
                  Yes, clear all data
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setConfirmingReset(false)}
                >
                  Keep data
                </button>
              </>
            ) : (
              <button
                type="button"
                className="button button--danger"
                onClick={() => setConfirmingReset(true)}
              >
                Clear all data
              </button>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}
