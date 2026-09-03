import { formatCurrency } from '../domain/format'
import type { PremiumBreakdown } from '../domain/types'

export function PremiumSummary({ premium }: { premium: PremiumBreakdown }) {
  return (
    <div>
      <div className="price-tag">
        <span className="price-tag__amount" data-testid="premium-total">
          {formatCurrency(premium.total)}
        </span>
        <span>per year</span>
      </div>
      <p className="field__help">
        or {formatCurrency(premium.monthly)} a month over 12 monthly instalments
      </p>
      <ul className="summary">
        <li>
          <span>Base premium</span>
          <span>{formatCurrency(premium.base)}</span>
        </li>
        <li>
          <span>Risk adjustment</span>
          <span>{formatCurrency(premium.riskAdjustment)}</span>
        </li>
        <li>
          <span>Optional cover</span>
          <span>{formatCurrency(premium.coverageAdditions)}</span>
        </li>
        <li>
          <span>Excess adjustment</span>
          <span>{formatCurrency(premium.excessAdjustment)}</span>
        </li>
        <li>
          <span>Loyalty discount</span>
          <span>-{formatCurrency(premium.loyaltyDiscount)}</span>
        </li>
        <li>
          <span>Net premium</span>
          <span>{formatCurrency(premium.netPremium)}</span>
        </li>
        <li>
          <span>Insurance premium tax</span>
          <span>{formatCurrency(premium.tax)}</span>
        </li>
        <li className="summary__total">
          <span>Total payable</span>
          <span>{formatCurrency(premium.total)}</span>
        </li>
      </ul>
    </div>
  )
}
