import { useState } from 'react'
import { PremiumSummary } from '../components/PremiumSummary'
import { StatusBadge } from '../components/StatusBadge'
import { getProduct } from '../domain/catalog'
import { formatCurrency, formatDate, formatWholeCurrency } from '../domain/format'
import { isRenewable, policyStatusOn } from '../domain/policies'
import type { Policy, Quote } from '../domain/types'
import { navigate } from '../router'
import { newId, useApp } from '../state/AppContext'

export function PoliciesPage() {
  const { state, dispatch } = useApp()
  const openQuotes = state.quotes.filter(
    (quote) => !state.policies.some((policy) => policy.quoteReference === quote.reference),
  )

  return (
    <div className="page">
      <header className="page__header">
        <h1>Your policies</h1>
        <p>Review your cover, renew it when it is due and keep your quotes in one place.</p>
      </header>

      <section className="section">
        <div className="section__title">
          <h2>Policies</h2>
          <button type="button" className="button button--ghost" onClick={() => navigate('/quote')}>
            Add another policy
          </button>
        </div>
        {state.policies.length === 0 ? (
          <div className="card empty-state">
            <p>You do not have any policies yet.</p>
            <button type="button" className="button" onClick={() => navigate('/quote')}>
              Get your first quote
            </button>
          </div>
        ) : (
          <div className="grid">
            {state.policies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                onRenew={() =>
                  dispatch({
                    type: 'policy/renewed',
                    policyId: policy.id,
                    now: new Date().toISOString(),
                  })
                }
                onCancel={() => dispatch({ type: 'policy/cancelled', policyId: policy.id })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Saved quotes</h2>
        {openQuotes.length === 0 ? (
          <div className="card empty-state">
            <p>No open quotes. Any quote you generate is saved here for 30 days.</p>
          </div>
        ) : (
          <div className="grid">
            {openQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onAccept={() =>
                  dispatch({
                    type: 'quote/accepted',
                    id: newId(),
                    quoteId: quote.id,
                    now: new Date().toISOString(),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function PolicyCard({
  policy,
  onRenew,
  onCancel,
}: {
  policy: Policy
  onRenew: () => void
  onCancel: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const product = getProduct(policy.productId)
  const now = new Date()
  const status = policyStatusOn(policy, now)
  const coverages = product.coverages.filter((coverage) =>
    policy.coverageIds.includes(coverage.id),
  )

  return (
    <article className="card record">
      <div className="record__head">
        <div>
          <h3>{product.name}</h3>
          <span className="record__reference">{policy.policyNumber}</span>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="record__meta">
        <div>
          {product.sumInsured.label}
          <strong>{formatWholeCurrency(policy.sumInsured)}</strong>
        </div>
        <div>
          Excess
          <strong>{formatWholeCurrency(policy.excess)}</strong>
        </div>
        <div>
          Annual premium
          <strong>{formatCurrency(policy.premium.total)}</strong>
        </div>
        <div>
          Cover period
          <strong>
            {formatDate(policy.startDate)} – {formatDate(policy.endDate)}
          </strong>
        </div>
      </div>

      {expanded && (
        <div className="grid grid--two">
          <div>
            <h4>Premium breakdown</h4>
            <PremiumSummary premium={policy.premium} />
          </div>
          <div>
            <h4>Cover details</h4>
            <p className="field__help">Policyholder: {policy.holder.fullName}</p>
            <p className="field__help">Quote reference: {policy.quoteReference}</p>
            <h4>Optional extras</h4>
            {coverages.length === 0 ? (
              <p className="field__help">No optional extras selected.</p>
            ) : (
              <ul>
                {coverages.map((coverage) => (
                  <li key={coverage.id}>{coverage.name}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="button-row">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Hide details' : 'View details'}
        </button>
        {status !== 'cancelled' && (
          <button
            type="button"
            className="button button--secondary"
            onClick={onRenew}
            disabled={!isRenewable(policy, now)}
            title={
              isRenewable(policy, now)
                ? 'Renew for another 12 months'
                : 'Renewal opens 30 days before expiry'
            }
          >
            Renew
          </button>
        )}
        {status !== 'cancelled' && !confirmingCancel && (
          <button
            type="button"
            className="button button--danger"
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel policy
          </button>
        )}
        {confirmingCancel && status !== 'cancelled' && (
          <>
            <span className="field__help">Cancel this policy? Cover ends immediately.</span>
            <button type="button" className="button button--danger" onClick={onCancel}>
              Yes, cancel
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setConfirmingCancel(false)}
            >
              Keep policy
            </button>
          </>
        )}
      </div>
    </article>
  )
}

function QuoteCard({ quote, onAccept }: { quote: Quote; onAccept: () => void }) {
  const product = getProduct(quote.productId)

  return (
    <article className="card record">
      <div className="record__head">
        <div>
          <h3>{product.name}</h3>
          <span className="record__reference">
            {quote.reference} · expires {formatDate(quote.expiresAt)}
          </span>
        </div>
        <span className="badge">Quote</span>
      </div>
      <div className="record__meta">
        <div>
          {product.sumInsured.label}
          <strong>{formatWholeCurrency(quote.input.sumInsured)}</strong>
        </div>
        <div>
          Annual price
          <strong>{formatCurrency(quote.premium.total)}</strong>
        </div>
        <div>
          Monthly
          <strong>{formatCurrency(quote.premium.monthly)}</strong>
        </div>
      </div>
      <div className="button-row">
        <button type="button" className="button" onClick={onAccept}>
          Buy this policy
        </button>
      </div>
    </article>
  )
}
