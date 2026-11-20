import { PremiumSummary } from '../components/PremiumSummary'
import { StatusBadge } from '../components/StatusBadge'
import { getProduct } from '../domain/catalog'
import { claimStatusLabels } from '../domain/claims'
import { formatCurrency, formatDate, formatWholeCurrency } from '../domain/format'
import { policyStatusOn } from '../domain/policies'
import { navigate } from '../router'
import { useApp } from '../state/AppContext'

/** A printable summary of one policy: who and what is covered, the price and its claims. */
export function PolicySchedulePage({ policyNumber }: { policyNumber: string }) {
  const { state } = useApp()
  const policy = state.policies.find((candidate) => candidate.policyNumber === policyNumber)
  const backToPolicies = (
    <button type="button" className="button button--ghost" onClick={() => navigate('/policies')}>
      ← Back to your policies
    </button>
  )

  if (!policy) {
    return (
      <div className="page">
        <header className="page__header">
          <h1>Policy not found</h1>
          <p>We could not find policy {policyNumber} in this browser.</p>
        </header>
        {backToPolicies}
      </div>
    )
  }

  const product = getProduct(policy.productId)
  const status = policyStatusOn(policy, new Date())
  const coverages = product.coverages.filter((coverage) =>
    policy.coverageIds.includes(coverage.id),
  )
  const claims = state.claims.filter((claim) => claim.policyNumber === policy.policyNumber)

  return (
    <div className="page">
      <div className="button-row no-print">
        {backToPolicies}
        <button type="button" className="button button--secondary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>

      <header className="page__header schedule__header">
        <div>
          <h1>Policy schedule</h1>
          <p>
            {product.name} from {state.settings.brandName}
          </p>
        </div>
        <div className="schedule__status">
          <span className="record__reference">{policy.policyNumber}</span>
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="grid grid--two section">
        <section className="card">
          <h2>Policyholder</h2>
          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{policy.holder.fullName}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{policy.holder.email}</dd>
            </div>
            <div>
              <dt>Date of birth</dt>
              <dd>{formatDate(policy.holder.dateOfBirth)}</dd>
            </div>
            <div>
              <dt>Postcode</dt>
              <dd>{policy.holder.postcode}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2>Cover</h2>
          <dl className="details">
            <div>
              <dt>Cover period</dt>
              <dd>
                {formatDate(policy.startDate)} – {formatDate(policy.endDate)}
              </dd>
            </div>
            <div>
              <dt>{product.sumInsured.label}</dt>
              <dd>{formatWholeCurrency(policy.sumInsured)}</dd>
            </div>
            <div>
              <dt>Excess</dt>
              <dd>{formatWholeCurrency(policy.excess)} for each claim</dd>
            </div>
            <div>
              <dt>Optional extras</dt>
              <dd>
                {coverages.length > 0
                  ? coverages.map((coverage) => coverage.name).join(', ')
                  : 'None'}
              </dd>
            </div>
            <div>
              <dt>Quote reference</dt>
              <dd>{policy.quoteReference}</dd>
            </div>
            {policy.cancelledAt && (
              <div>
                <dt>Cancelled on</dt>
                <dd>{formatDate(policy.cancelledAt)}</dd>
              </div>
            )}
            {policy.refund !== undefined && (
              <div>
                <dt>Refund</dt>
                <dd>{formatCurrency(policy.refund)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card">
          <h2>Your answers</h2>
          <dl className="details">
            {product.riskFactors.map((factor) => (
              <div key={factor.id}>
                <dt>{factor.label}</dt>
                <dd>
                  {factor.options.find((option) => option.value === policy.riskAnswers[factor.id])
                    ?.label ?? 'Not recorded'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="field__help">
            Tell us at {state.settings.supportEmail} straight away if any of these answers change.
          </p>
        </section>

        <section className="card">
          <h2>Premium</h2>
          <PremiumSummary premium={policy.premium} />
        </section>
      </div>

      <section className="card">
        <h2>Claims</h2>
        {claims.length === 0 ? (
          <p className="field__help">No claims have been made on this policy.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Incident date</th>
                  <th scope="col">Amount claimed</th>
                  <th scope="col">Status</th>
                  <th scope="col">Settlement paid</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <tr key={claim.id}>
                    <td>{claim.reference}</td>
                    <td>{formatDate(claim.incidentDate)}</td>
                    <td>{formatCurrency(claim.amountClaimed)}</td>
                    <td>{claimStatusLabels[claim.status]}</td>
                    <td>
                      {claim.settledAmount === undefined
                        ? '—'
                        : formatCurrency(claim.settledAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
