import { ProductCard } from '../components/ProductCard'
import { products } from '../domain/catalog'
import { formatCurrency } from '../domain/format'
import { navigate } from '../router'
import { useApp } from '../state/AppContext'

export function HomePage() {
  const { state } = useApp()
  const activePolicies = state.policies.filter((policy) => policy.status === 'active')
  const openClaims = state.claims.filter(
    (claim) => claim.status !== 'settled' && claim.status !== 'declined',
  )
  const annualSpend = activePolicies.reduce((total, policy) => total + policy.premium.total, 0)

  return (
    <div className="page">
      <section className="hero">
        <div>
          <h1>Insurance that works the way you do</h1>
          <p>
            Advantage brings quoting, policy administration and claims together in one place. Pick a
            product, answer a handful of questions and buy cover in minutes — then manage everything
            from the same dashboard.
          </p>
          <div className="hero__actions">
            <button type="button" className="button" onClick={() => navigate('/quote')}>
              Get a quote
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => navigate('/claims')}
            >
              Make a claim
            </button>
          </div>
        </div>
        <div className="hero__panel">
          <h2>Why Advantage</h2>
          <ul>
            <li>Transparent pricing with a full premium breakdown</li>
            <li>Up to 15% loyalty discount across your policies</li>
            <li>Claims tracked end to end, with no paperwork</li>
          </ul>
        </div>
      </section>

      {state.policies.length > 0 && (
        <section className="section">
          <div className="section__title">
            <h2>Your account at a glance</h2>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => navigate('/policies')}
            >
              Manage policies
            </button>
          </div>
          <div className="grid grid--stats">
            <div className="stat">
              <div className="stat__value">{activePolicies.length}</div>
              <div className="stat__label">Active policies</div>
            </div>
            <div className="stat">
              <div className="stat__value">{formatCurrency(annualSpend)}</div>
              <div className="stat__label">Annual premium</div>
            </div>
            <div className="stat">
              <div className="stat__value">{openClaims.length}</div>
              <div className="stat__label">Open claims</div>
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__title">
          <h2>Our cover</h2>
          <p className="field__help">Every product is quoted instantly, with no obligation.</p>
        </div>
        <div className="grid grid--products">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <div className="grid grid--products">
          <article className="card">
            <h3>1. Tell us about you</h3>
            <p className="field__help">
              A short set of questions establishes the risk we are being asked to cover.
            </p>
          </article>
          <article className="card">
            <h3>2. Shape your cover</h3>
            <p className="field__help">
              Choose your sum insured, excess and optional extras and watch the price update live.
            </p>
          </article>
          <article className="card">
            <h3>3. Buy and manage</h3>
            <p className="field__help">
              Accept your quote to issue the policy, then renew, cancel or claim whenever you need
              to.
            </p>
          </article>
        </div>
      </section>
    </div>
  )
}
