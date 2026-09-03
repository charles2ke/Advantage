import { useRoute } from './router'
import { ClaimsPage } from './pages/ClaimsPage'
import { HomePage } from './pages/HomePage'
import { PoliciesPage } from './pages/PoliciesPage'
import { QuotePage } from './pages/QuotePage'
import { useApp } from './state/AppContext'

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/quote', label: 'Get a quote' },
  { path: '/policies', label: 'Policies' },
  { path: '/claims', label: 'Claims' },
]

function isCurrent(navPath: string, segments: string[]): boolean {
  const section = segments[0] ? `/${segments[0]}` : '/'
  return navPath === section
}

export function App() {
  const { segments } = useRoute()
  const { state } = useApp()
  const section = segments[0] ?? ''

  let page
  switch (section) {
    case '':
      page = <HomePage />
      break
    case 'quote':
      page = <QuotePage productId={segments[1]} />
      break
    case 'policies':
      page = <PoliciesPage />
      break
    case 'claims':
      page = <ClaimsPage />
      break
    default:
      page = (
        <div className="page">
          <h1>Page not found</h1>
          <p>
            The page you were looking for does not exist. <a href="#/">Return to the homepage</a>.
          </p>
        </div>
      )
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="#/">
            <span className="brand__mark" aria-hidden="true">
              A
            </span>
            <span>
              Advantage
              <span className="brand__tag"> — your one stop insurance platform</span>
            </span>
          </a>
          <nav className="nav" aria-label="Main">
            {navItems.map((item) => (
              <a
                key={item.path}
                className="nav__link"
                href={`#${item.path}`}
                aria-current={isCurrent(item.path, segments) ? 'page' : undefined}
              >
                {item.label}
                {item.path === '/policies' && state.policies.length > 0
                  ? ` (${state.policies.length})`
                  : ''}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>{page}</main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <span>Advantage Insurance — a demonstration platform. No real cover is provided.</span>
          <span>Quotes and policies are stored in this browser only.</span>
        </div>
      </footer>
    </div>
  )
}
