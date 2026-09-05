import { useMemo, useState } from 'react'
import { formatCurrency, formatDate, formatWholeCurrency } from '../domain/format'
import { ratePremium, validateApplicant, validateQuoteInput } from '../domain/rating'
import type { Applicant, Product, QuoteInput } from '../domain/types'
import { navigate } from '../router'
import { newId, useApp } from '../state/AppContext'
import { PremiumSummary } from './PremiumSummary'

const stepTitles = ['Your details', 'Your cover', 'Your quote']

const emptyApplicant: Applicant = {
  fullName: '',
  email: '',
  dateOfBirth: '',
  postcode: '',
}

function defaultExcess(product: Product): number {
  const middle = Math.floor((product.excessOptions.length - 1) / 2)
  return product.excessOptions[middle].value
}

export function QuoteWizard({ product }: { product: Product }) {
  const { state, dispatch } = useApp()
  const [step, setStep] = useState(0)
  const [applicant, setApplicant] = useState<Applicant>(emptyApplicant)
  const [sumInsured, setSumInsured] = useState(product.sumInsured.default)
  const [excess, setExcess] = useState(() => defaultExcess(product))
  const [coverageIds, setCoverageIds] = useState<string[]>([])
  const [riskAnswers, setRiskAnswers] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [quoteId, setQuoteId] = useState<string | null>(null)

  const existingPolicies = state.policies.filter((policy) => policy.status === 'active').length

  const input: QuoteInput = useMemo(
    () => ({
      productId: product.id,
      applicant,
      sumInsured,
      excess,
      coverageIds,
      riskAnswers,
      existingPolicies,
    }),
    [applicant, coverageIds, excess, existingPolicies, product.id, riskAnswers, sumInsured],
  )

  const livePremium = useMemo(() => ratePremium(input, new Date(), state.settings), [input, state.settings])
  const quote = state.quotes.find((candidate) => candidate.id === quoteId)
  const policy = quote
    ? state.policies.find((candidate) => candidate.quoteReference === quote.reference)
    : undefined

  function updateApplicant(patch: Partial<Applicant>) {
    setApplicant((current) => ({ ...current, ...patch }))
  }

  function toggleCoverage(coverageId: string) {
    setCoverageIds((current) =>
      current.includes(coverageId)
        ? current.filter((id) => id !== coverageId)
        : [...current, coverageId],
    )
  }

  function goToCover() {
    const found = validateApplicant(applicant)
    setErrors(found)
    if (found.length === 0) {
      setStep(1)
    }
  }

  function generateQuote() {
    const found = validateQuoteInput(input)
    setErrors(found)
    if (found.length > 0) {
      return
    }
    const id = newId()
    dispatch({ type: 'quote/created', id, input, now: new Date().toISOString() })
    setQuoteId(id)
    setStep(2)
  }

  function buyPolicy() {
    if (!quote) {
      return
    }
    dispatch({
      type: 'quote/accepted',
      id: newId(),
      quoteId: quote.id,
      now: new Date().toISOString(),
    })
  }

  return (
    <div>
      <ol className="steps">
        {stepTitles.map((title, index) => (
          <li key={title} aria-current={index === step ? 'step' : undefined}>
            <span>
              {index + 1}. {title}
            </span>
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div className="alert alert--error" role="alert">
          <strong>We need a few more details</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid--two">
        <div className="card">
          {step === 0 && (
            <>
              <h2>About you</h2>
              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={applicant.fullName}
                  onChange={(event) => updateApplicant({ fullName: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={applicant.email}
                  onChange={(event) => updateApplicant({ email: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="dateOfBirth">Date of birth</label>
                <input
                  id="dateOfBirth"
                  type="date"
                  value={applicant.dateOfBirth}
                  onChange={(event) => updateApplicant({ dateOfBirth: event.target.value })}
                />
                <span className="field__help">You must be 18 or over to hold a policy.</span>
              </div>
              <div className="field">
                <label htmlFor="postcode">Postcode</label>
                <input
                  id="postcode"
                  type="text"
                  autoComplete="postal-code"
                  value={applicant.postcode}
                  onChange={(event) => updateApplicant({ postcode: event.target.value })}
                />
              </div>
              <div className="button-row">
                <button type="button" className="button" onClick={goToCover}>
                  Continue to cover
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Choose your cover</h2>
              <div className="field">
                <label htmlFor="sumInsured">{product.sumInsured.label}</label>
                <input
                  id="sumInsured"
                  type="number"
                  min={product.sumInsured.min}
                  max={product.sumInsured.max}
                  step={product.sumInsured.step}
                  value={sumInsured}
                  onChange={(event) => setSumInsured(Number(event.target.value))}
                />
                <span className="field__help">
                  Between {formatWholeCurrency(product.sumInsured.min)} and{' '}
                  {formatWholeCurrency(product.sumInsured.max)}.
                </span>
              </div>

              {product.excessOptions.length > 1 && (
                <div className="field">
                  <label htmlFor="excess">Excess</label>
                  <select
                    id="excess"
                    value={excess}
                    onChange={(event) => setExcess(Number(event.target.value))}
                  >
                    {product.excessOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {formatWholeCurrency(option.value)}
                      </option>
                    ))}
                  </select>
                  <span className="field__help">
                    The amount you pay towards each claim. A higher excess lowers your premium.
                  </span>
                </div>
              )}

              {product.riskFactors.map((factor) => (
                <div className="field" key={factor.id}>
                  <label htmlFor={`risk-${factor.id}`}>{factor.label}</label>
                  <select
                    id={`risk-${factor.id}`}
                    value={riskAnswers[factor.id] ?? ''}
                    onChange={(event) =>
                      setRiskAnswers((current) => ({ ...current, [factor.id]: event.target.value }))
                    }
                  >
                    <option value="">Please choose…</option>
                    {factor.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field__help">{factor.help}</span>
                </div>
              ))}

              <fieldset>
                <legend>Optional extras</legend>
                {product.coverages.map((coverage) => (
                  <label className="checkbox-option" key={coverage.id}>
                    <input
                      type="checkbox"
                      checked={coverageIds.includes(coverage.id)}
                      onChange={() => toggleCoverage(coverage.id)}
                    />
                    <span>
                      <strong>{coverage.name}</strong>
                      <span className="checkbox-option__text"> — {coverage.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              <div className="button-row">
                <button type="button" className="button" onClick={generateQuote}>
                  See my price
                </button>
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setStep(0)}
                >
                  Back
                </button>
              </div>
            </>
          )}

          {step === 2 && quote && (
            <>
              <h2>Your quote is ready</h2>
              <p className="record__reference">
                Reference {quote.reference} · valid until {formatDate(quote.expiresAt)}
              </p>
              <PremiumSummary premium={quote.premium} />
              {policy ? (
                <div className="alert alert--success" role="status">
                  <strong>Policy {policy.policyNumber} is now active.</strong>
                  <p>
                    Cover runs until {formatDate(policy.endDate)}. You can manage it from the
                    policies page.
                  </p>
                </div>
              ) : (
                <div className="button-row">
                  <button type="button" className="button" onClick={buyPolicy}>
                    Buy this policy
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setStep(1)}
                  >
                    Change my cover
                  </button>
                </div>
              )}
              {policy && (
                <div className="button-row">
                  <button
                    type="button"
                    className="button"
                    onClick={() => navigate('/policies')}
                  >
                    View my policies
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="card" aria-label="Price estimate">
          <h3>{product.name}</h3>
          <p className="field__help">{product.tagline}</p>
          {step === 2 && quote ? (
            <ul className="summary">
              <li>
                <span>{product.sumInsured.label}</span>
                <span>{formatWholeCurrency(quote.input.sumInsured)}</span>
              </li>
              <li>
                <span>Excess</span>
                <span>{formatWholeCurrency(quote.input.excess)}</span>
              </li>
              <li className="summary__total">
                <span>Annual price</span>
                <span>{formatCurrency(quote.premium.total)}</span>
              </li>
            </ul>
          ) : (
            <>
              <div className="price-tag">
                <span className="price-tag__amount" data-testid="live-premium">
                  {formatCurrency(livePremium.total)}
                </span>
                <span>per year</span>
              </div>
              <p className="field__help">
                Live estimate — it updates as you answer the questions, and is confirmed when you
                request your quote.
              </p>
              <ul className="summary">
                <li>
                  <span>{product.sumInsured.label}</span>
                  <span>{formatWholeCurrency(sumInsured)}</span>
                </li>
                <li>
                  <span>Excess</span>
                  <span>{formatWholeCurrency(excess)}</span>
                </li>
                <li>
                  <span>Optional extras</span>
                  <span>{coverageIds.length}</span>
                </li>
                {existingPolicies > 0 && (
                  <li>
                    <span>Loyalty discount</span>
                    <span>-{formatCurrency(livePremium.loyaltyDiscount)}</span>
                  </li>
                )}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
