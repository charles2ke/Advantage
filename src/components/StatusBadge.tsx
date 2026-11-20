import type { ClaimStatus, PolicyStatus } from '../domain/types'
import { claimStatusLabels } from '../domain/claims'
import { policyStatusLabels } from '../domain/policies'

export function StatusBadge({ status }: { status: PolicyStatus | ClaimStatus }) {
  const label =
    status in policyStatusLabels
      ? policyStatusLabels[status as PolicyStatus]
      : claimStatusLabels[status as ClaimStatus]

  return <span className={`badge badge--${status}`}>{label}</span>
}
