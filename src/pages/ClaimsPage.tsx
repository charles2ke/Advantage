import { useMemo, useState } from 'react'
import { StatusBadge } from '../components/StatusBadge'
import { getProduct } from '../domain/catalog'
import {
  claimStatusLabels,
  claimTransitions,
  settlementAmount,
  validateClaimInput,
  type ClaimInput,
} from '../domain/claims'
import { formatCurrency, formatDate } from '../domain/format'
import type { Claim, ClaimStatus } from '../domain/types'
import { navigate } from '../router'
import { newId, useApp } from '../state/AppContext'

const transitionNotes: Record<ClaimStatus, string> = {
  submitted: 'Claim received.',
  in_review: 'A claims handler is reviewing the evidence.',
  approved: 'The claim has been approved and is awaiting payment.',
  declined: 'The claim falls outside the terms of the policy.',
  settled: 'Settlement has been paid to the policyholder.',
}

export function ClaimsPage() {
  const { state, dispatch } = useApp()
  const claimablePolicies = state.policies.filter((policy) => policy.status !== 'cancelled')

  const [policyNumber, setPolicyNumber] = useState('')
  const [incidentDate, setIncidentDate] = useState('')
  const [description, setDescription] = useState('')
  const [amountClaimed, setAmountClaimed] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [submittedClaimId, setSubmittedClaimId] = useState<string | null>(null)
  const submittedReference = useMemo(
    () => state.claims.find((claim) => claim.id === submittedClaimId)?.reference ?? null,
    [state.claims, submittedClaimId],
  )

  function submitClaim() {
    const input: ClaimInput = {
      policyNumber,
      incidentDate,
      description,
      amountClaimed: Number(amountClaimed),
    }
    const policy = state.policies.find((candidate) => candidate.policyNumber === policyNumber)
    const now = new Date()
    const found = validateClaimInput(input, policy, now)
    setErrors(found)
    setSubmittedClaimId(null)
    if (found.length > 0 || !policy) {
      return
    }
    const id = newId()
    dispatch({ type: 'claim/created', id, input, now: now.toISOString() })
    setSubmittedClaimId(id)
    setIncidentDate('')
    setDescription('')
    setAmountClaimed('')
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Claims</h1>
        <p>
          Tell us what happened and we will get your claim moving. You can follow every step here.
        </p>
      </header>

      <section className="section">
        <h2>Make a claim</h2>
        {claimablePolicies.length === 0 ? (
          <div className="card empty-state">
            <p>You need an active policy before you can make a claim.</p>
            <button type="button" className="button" onClick={() => navigate('/quote')}>
              Get a quote
            </button>
          </div>
        ) : (
          <div className="card">
            {errors.length > 0 && (
              <div className="alert alert--error" role="alert">
                <strong>We could not submit your claim</strong>
                <ul>
                  {errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {submittedReference && (
              <div className="alert alert--success" role="status">
                <strong>Claim {submittedReference} submitted.</strong>
                <p>We will be in touch within one working day.</p>
              </div>
            )}

            <div className="field">
              <label htmlFor="policyNumber">Policy</label>
              <select
                id="policyNumber"
                value={policyNumber}
                onChange={(event) => setPolicyNumber(event.target.value)}
              >
                <option value="">Please choose…</option>
                {claimablePolicies.map((policy) => (
                  <option key={policy.id} value={policy.policyNumber}>
                    {getProduct(policy.productId).name} — {policy.policyNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="incidentDate">Date of the incident</label>
              <input
                id="incidentDate"
                type="date"
                value={incidentDate}
                onChange={(event) => setIncidentDate(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="description">What happened?</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <span className="field__help">
                Include where it happened and any third parties involved.
              </span>
            </div>
            <div className="field">
              <label htmlFor="amountClaimed">Amount claimed</label>
              <input
                id="amountClaimed"
                type="number"
                min={0}
                step={10}
                value={amountClaimed}
                onChange={(event) => setAmountClaimed(event.target.value)}
              />
            </div>
            <div className="button-row">
              <button type="button" className="button" onClick={submitClaim}>
                Submit claim
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Your claims</h2>
        {state.claims.length === 0 ? (
          <div className="card empty-state">
            <p>You have not made any claims.</p>
          </div>
        ) : (
          <div className="grid">
            {state.claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                onAdvance={(status) =>
                  dispatch({
                    type: 'claim/advanced',
                    claimId: claim.id,
                    status,
                    note: transitionNotes[status],
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

function ClaimCard({
  claim,
  onAdvance,
}: {
  claim: Claim
  onAdvance: (status: ClaimStatus) => void
}) {
  const { state } = useApp()
  const policy = state.policies.find((candidate) => candidate.policyNumber === claim.policyNumber)
  const product = getProduct(claim.productId)
  const nextStatuses = claimTransitions[claim.status]

  return (
    <article className="card record">
      <div className="record__head">
        <div>
          <h3>
            {product.name} claim <span className="record__reference">{claim.reference}</span>
          </h3>
          <span className="record__reference">Policy {claim.policyNumber}</span>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <div className="record__meta">
        <div>
          Incident date
          <strong>{formatDate(claim.incidentDate)}</strong>
        </div>
        <div>
          Amount claimed
          <strong>{formatCurrency(claim.amountClaimed)}</strong>
        </div>
        {policy && (
          <div>
            Payable after excess
            <strong>{formatCurrency(settlementAmount(claim, policy))}</strong>
          </div>
        )}
      </div>

      <p>{claim.description}</p>

      <ol className="timeline">
        {claim.timeline.map((event) => (
          <li key={`${event.status}-${event.at}`}>
            <strong>{claimStatusLabels[event.status]}</strong> · {formatDate(event.at)}
            <br />
            {event.note}
          </li>
        ))}
      </ol>

      {nextStatuses.length > 0 && (
        <div className="button-row">
          <span className="field__help">Claim handling actions:</span>
          {nextStatuses.map((status) => (
            <button
              key={status}
              type="button"
              className={status === 'declined' ? 'button button--danger' : 'button button--secondary'}
              onClick={() => onAdvance(status)}
            >
              Mark as {claimStatusLabels[status].toLowerCase()}
            </button>
          ))}
        </div>
      )}
    </article>
  )
}
