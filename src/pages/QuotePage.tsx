import { QuoteWizard } from '../components/QuoteWizard'
import { findProduct, products } from '../domain/catalog'
import { formatWholeCurrency } from '../domain/format'
import { navigate } from '../router'

export function QuotePage({ productId }: { productId?: string }) {
  const product = productId ? findProduct(productId) : undefined

  if (productId && !product) {
    return (
      <div className="page">
        <div className="alert alert--error" role="alert">
          We could not find that product. Choose one of our covers below.
        </div>
        <ProductChooser />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="page">
        <header className="page__header">
          <h1>Get a quote</h1>
          <p>Choose the cover you need and we will price it in a couple of minutes.</p>
        </header>
        <ProductChooser />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>{product.name} quote</h1>
        <p>{product.description}</p>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => navigate('/quote')}
        >
          ← Choose a different product
        </button>
      </header>
      <QuoteWizard key={product.id} product={product} />
    </div>
  )
}

function ProductChooser() {
  return (
    <div className="grid grid--products">
      {products.map((product) => (
        <article className="card product-card" key={product.id}>
          <h3>{product.name}</h3>
          <p className="field__help">{product.description}</p>
          <p className="product-card__price">
            {product.sumInsured.label} up to {formatWholeCurrency(product.sumInsured.max)}
          </p>
          <div className="product-card__actions">
            <button
              type="button"
              className="button"
              onClick={() => navigate(`/quote/${product.id}`)}
            >
              Quote {product.name.toLowerCase()}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
