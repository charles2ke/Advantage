import { useEffect, useRef, useState } from 'react'
import { ConfirmPanel } from '../components/ConfirmPanel'
import { PremiumSummary } from '../components/PremiumSummary'
import { StatusBadge } from '../components/StatusBadge'
import { getProduct } from '../domain/catalog'
import { claimsInCurrentTerm } from '../domain/claims'
import { formatCount, formatCurrency, formatDate, formatWholeCurrency } from '../domain/format'
import {
  cancellationRefund,
  filterPolicies,
  isRenewable,
  POLICY_TERM_MONTHS,
  policyStatusLabels,
  policyStatusOn,
  RENEWAL_WINDOW_DAYS,
  renewalStartDate,
  type PolicyFilterStatus,
} from '../domain/policies'
import { quoteStatus, type QuoteStatus } from '../domain/rating'
import type { Policy, PolicyStatus, Quote } from '../domain/types'
import { navigate } from '../router'
import { newId, useApp } from '../state/AppContext'
import { renewalPremium } from '../state/selectors'

const policyStatuses = Object.keys(policyStatusLabels) as PolicyStatus[]

const quoteBadges: Record<QuoteStatus, { label: string; className: string }> = {
  open: { label: 'Quote', className: 'badge' },
  expired: { label: 'Expired', className: 'badge badge--expired' },
  unavailable: { label: 'Not on sale', className: 'badge badge--unavailable' },
}

export function PoliciesPage() {
  const { state, dispatch } = useApp()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PolicyFilterStatus>('all')
  // Policies renewed or cancelled here stay listed until the search changes, so the
  // outcome can still be read when the policy no longer matches the status filter.
  const [changedPolicyIds, setChangedPolicyIds] = useState<string[]>([])
  const now = new Date()
  const savedQuotes = state.quotes.filter(
    (quote) => !state.policies.some((policy) => policy.quoteReference === quote.reference),
  )
  const matchingPolicies = filterPolicies(state.policies, { query, status: statusFilter }, now)
  const visiblePolicies = state.policies.filter(
    (policy) => matchingPolicies.includes(policy) || changedPolicyIds.includes(policy.id),
  )
  const validityDays = state.settings.quoteValidityDays

  function keepInView(policyId: string) {
    setChangedPolicyIds((ids) => (ids.includes(policyId) ? ids : [...ids, policyId]))
  }

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
          <>
            {state.policies.length > 1 && (
              <div className="toolbar" role="search" aria-label="Find a policy">
                <div className="field field--inline">
                  <label htmlFor="policySearch">Search</label>
                  <input
                    id="policySearch"
                    type="search"
                    placeholder="Policy number, name or postcode"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setChangedPolicyIds([])
                    }}
                  />
                </div>
                <div className="field field--inline">
                  <label htmlFor="policyStatusFilter">Status</label>
                  <select
                    id="policyStatusFilter"
                    value={statusFilter}
                    onChange={(event) => {
                      setStatusFilter(event.target.value as PolicyFilterStatus)
                      setChangedPolicyIds([])
                    }}
                  >
                    <option value="all">All statuses</option>
                    {policyStatuses.map((status) => (
                      <option key={status} value={status}>
                        {policyStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="field__help toolbar__count" aria-live="polite">
                  Showing {visiblePolicies.length} of{' '}
                  {formatCount(state.policies.length, 'policy', 'policies')}
                </p>
              </div>
            )}
            {visiblePolicies.length === 0 ? (
              <div className="card empty-state">
                <p>No policies match your search.</p>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => {
                    setQuery('')
                    setStatusFilter('all')
                  }}
                >
                  Show all policies
                </button>
              </div>
            ) : (
              <div className="grid">
                {visiblePolicies.map((policy) => (
                  <PolicyCard
                    key={policy.id}
                    policy={policy}
                    onRenew={() => {
                      keepInView(policy.id)
                      dispatch({
                        type: 'policy/renewed',
                        policyId: policy.id,
                        now: new Date().toISOString(),
                      })
                    }}
                    onCancel={() => {
                      keepInView(policy.id)
                      dispatch({
                        type: 'policy/cancelled',
                        policyId: policy.id,
                        now: new Date().toISOString(),
                      })
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section className="section">
        <h2>Saved quotes</h2>
        {savedQuotes.length === 0 ? (
          <div className="card empty-state">
            <p>
              No saved quotes. Any quote you generate is kept here and can be bought for{' '}
              {formatCount(validityDays, 'day')}.
            </p>
          </div>
        ) : (
          <div className="grid">
            {savedQuotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                status={quoteStatus(quote, state.settings, now)}
                onAccept={() =>
                  dispatch({
                    type: 'quote/accepted',
                    id: newId(),
                    quoteId: quote.id,
                    now: new Date().toISOString(),
                  })
                }
                onDiscard={() => dispatch({ type: 'quote/discarded', quoteId: quote.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type Confirmation = 'renew' | 'cancel'

function PolicyCard({
  policy,
  onRenew,
  onCancel,
}: {
  policy: Policy
  onRenew: () => void
  onCancel: () => void
}) {
  const { state } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [confirming, setConfirming] = useState<Confirmation | null>(null)
  const [notice, setNotice] = useState<Confirmation | null>(null)
  const renewButton = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const product = getProduct(policy.productId)
  const now = new Date()
  const status = policyStatusOn(policy, now)
  const renewable = isRenewable(policy, now)
  const coverages = product.coverages.filter((coverage) =>
    policy.coverageIds.includes(coverage.id),
  )
  const confirmation =
    (confirming === 'renew' && renewable) || (confirming === 'cancel' && status !== 'cancelled')
      ? confirming
      : null

  useEffect(() => {
    noticeRef.current?.focus()
  }, [notice])

  function closeConfirmation() {
    const trigger = confirming === 'renew' ? renewButton : cancelButton
    setConfirming(null)
    trigger.current?.focus()
  }

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
        {policy.cancelledAt && (
          <div>
            Cancelled on
            <strong>{formatDate(policy.cancelledAt)}</strong>
          </div>
        )}
        {policy.refund !== undefined && (
          <div>
            Refund
            <strong>{formatCurrency(policy.refund)}</strong>
          </div>
        )}
      </div>

      {notice === 'renew' && status === 'active' && (
        <p className="alert alert--success" role="status" tabIndex={-1} ref={noticeRef}>
          Renewed. Your cover now runs until {formatDate(policy.endDate)}.
        </p>
      )}
      {notice === 'cancel' && status === 'cancelled' && (
        <p className="alert alert--success" role="status" tabIndex={-1} ref={noticeRef}>
          Policy cancelled.{' '}
          {policy.refund
            ? `A refund of ${formatCurrency(policy.refund)} will be paid to you.`
            : 'No refund is due.'}
        </p>
      )}

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
        <button
          type="button"
          className="button button--secondary"
          onClick={() => navigate(`/policies/${policy.policyNumber}`)}
        >
          Policy schedule
        </button>
        {status !== 'cancelled' && (
          <button
            ref={renewButton}
            type="button"
            className="button button--secondary"
            onClick={() => {
              setNotice(null)
              setConfirming('renew')
            }}
            disabled={!renewable}
            aria-expanded={confirmation === 'renew'}
            title={
              renewable
                ? `Renew for another ${POLICY_TERM_MONTHS} months`
                : `Renewal opens ${RENEWAL_WINDOW_DAYS} days before expiry`
            }
          >
            Renew
          </button>
        )}
        {status !== 'cancelled' && (
          <button
            ref={cancelButton}
            type="button"
            className="button button--danger"
            onClick={() => {
              setNotice(null)
              setConfirming('cancel')
            }}
            aria-expanded={confirmation === 'cancel'}
          >
            Cancel policy
          </button>
        )}
      </div>

      {confirmation === 'renew' && (
        <RenewalConfirmation
          policy={policy}
          now={now}
          premium={renewalPremium(state, policy, now)}
          onConfirm={() => {
            setConfirming(null)
            setNotice('renew')
            onRenew()
          }}
          onDismiss={closeConfirmation}
        />
      )}
      {confirmation === 'cancel' && (
        <ConfirmPanel
          label="Confirm cancellation"
          actions={
            <>
              <button
                type="button"
                className="button button--danger"
                onClick={() => {
                  setConfirming(null)
                  setNotice('cancel')
                  onCancel()
                }}
              >
                Yes, cancel
              </button>
              <button type="button" className="button button--secondary" onClick={closeConfirmation}>
                Keep policy
              </button>
            </>
          }
        >
          <p>
            <strong>Cancel this policy?</strong> Cover ends immediately.
          </p>
          <p className="field__help">
            {refundMessage(
              cancellationRefund(policy, now, state.claims),
              claimsInCurrentTerm(policy, state.claims).length > 0,
            )}
          </p>
        </ConfirmPanel>
      )}
    </article>
  )
}

function refundMessage(refund: number, claimMade: boolean): string {
  if (claimMade) {
    return 'No refund is due because a claim has been made in this period of cover.'
  }
  return refund > 0
    ? `You will be refunded ${formatCurrency(refund)} for the unused part of your cover.`
    : 'No refund is due.'
}

function RenewalConfirmation({
  policy,
  now,
  premium,
  onConfirm,
  onDismiss,
}: {
  policy: Policy
  now: Date
  premium: Policy['premium']
  onConfirm: () => void
  onDismiss: () => void
}) {
  const current = policy.premium.total
  let comparison = ', the same as now'
  if (premium.total > current) {
    comparison = `, up from ${formatCurrency(current)}`
  } else if (premium.total < current) {
    comparison = `, down from ${formatCurrency(current)}`
  }

  return (
    <ConfirmPanel
      label="Confirm renewal"
      actions={
        <>
          <button type="button" className="button" onClick={onConfirm}>
            Confirm renewal
          </button>
          <button type="button" className="button button--secondary" onClick={onDismiss}>
            Not now
          </button>
        </>
      }
    >
      <p>
        <strong>Renew for another {POLICY_TERM_MONTHS} months?</strong> Your new cover starts on{' '}
        {formatDate(renewalStartDate(policy, now).toISOString())}.
      </p>
      <p data-testid="renewal-price">
        The price for the year is <strong>{formatCurrency(premium.total)}</strong>
        {comparison}, or {formatCurrency(premium.monthly)} a month.
      </p>
      <p className="field__help">
        Renewal prices are worked out again with today&apos;s rates, your age when the new cover
        starts and the other policies you hold.
      </p>
    </ConfirmPanel>
  )
}

function QuoteCard({
  quote,
  status,
  onAccept,
  onDiscard,
}: {
  quote: Quote
  status: QuoteStatus
  onAccept: () => void
  onDiscard: () => void
}) {
  const product = getProduct(quote.productId)
  const badge = quoteBadges[status]

  return (
    <article className="card record">
      <div className="record__head">
        <div>
          <h3>{product.name}</h3>
          <span className="record__reference">
            {quote.reference} · {status === 'expired' ? 'expired' : 'expires'}{' '}
            {formatDate(quote.expiresAt)}
          </span>
        </div>
        <span className={badge.className}>{badge.label}</span>
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
      {status === 'expired' && (
        <p className="field__help">
          This quote has expired and can no longer be bought. Get a new quote for today&apos;s
          price.
        </p>
      )}
      {status === 'unavailable' && (
        <p className="field__help">
          {product.name} is not on sale at the moment, so this quote cannot be bought.
        </p>
      )}
      <div className="button-row">
        {status === 'open' && (
          <button type="button" className="button" onClick={onAccept}>
            Buy this policy
          </button>
        )}
        {status === 'expired' && (
          <button
            type="button"
            className="button"
            onClick={() => navigate(`/quote/${quote.productId}`)}
          >
            Get a new quote
          </button>
        )}
        <button type="button" className="button button--secondary" onClick={onDiscard}>
          Discard quote
        </button>
      </div>
    </article>
  )
}
