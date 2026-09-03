import type { ClaimStatus, PolicyStatus } from '../domain/types'
import { claimStatusLabels } from '../domain/claims'

const policyStatusLabels: Record<PolicyStatus, string> = {
  active: 'Active',
  lapsed: 'Lapsed',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status }: { status: PolicyStatus | ClaimStatus }) {
  const label =
    status in policyStatusLabels
      ? policyStatusLabels[status as PolicyStatus]
      : claimStatusLabels[status as ClaimStatus]

  return <span className={`badge badge--${status}`}>{label}</span>
}
