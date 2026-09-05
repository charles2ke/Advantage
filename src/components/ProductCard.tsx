import { formatCurrency } from '../domain/format'
import { ratePremium } from '../domain/rating'
import type { PlatformSettings } from '../domain/settings'
import type { Product } from '../domain/types'
import { navigate } from '../router'
import { useApp } from '../state/AppContext'

/** Illustrative price for a standard risk, used on the marketing cards. */
function indicativePrice(product: Product, settings: PlatformSettings): number {
  return ratePremium({
    productId: product.id,
    applicant: { fullName: '', email: '', dateOfBirth: '1985-01-01', postcode: '' },
    sumInsured: product.sumInsured.default,
    excess: product.excessOptions[Math.floor((product.excessOptions.length - 1) / 2)].value,
    coverageIds: [],
    riskAnswers: Object.fromEntries(
      product.riskFactors.map((factor) => [factor.id, factor.options[0].value]),
    ),
    existingPolicies: 0,
  }, new Date(), settings).total
}

export function ProductCard({ product }: { product: Product }) {
  const { state } = useApp()

  return (
    <article className="card product-card">
      <h3>{product.name}</h3>
      <p className="field__help">{product.tagline}</p>
      <ul>
        {product.benefits.map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>
      <p className="product-card__price">
        From <strong>{formatCurrency(indicativePrice(product, state.settings))}</strong> a year
      </p>
      <div className="product-card__actions">
        <button
          type="button"
          className="button"
          onClick={() => navigate(`/quote/${product.id}`)}
        >
          Get a quote
        </button>
      </div>
    </article>
  )
}
