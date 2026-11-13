import { countPoliciesInForce, rateRenewal } from '../domain/policies'
import type { Applicant, Policy, PremiumBreakdown } from '../domain/types'
import type { AppState } from './storage'

/**
 * The premium for the next term of a policy, priced with the current settings
 * and the loyalty discount for the holder's other policies in force.
 */
export function renewalPremium(state: AppState, policy: Policy, on: Date): PremiumBreakdown {
  return rateRenewal(policy, {
    on,
    settings: state.settings,
    existingPolicies: countPoliciesInForce(state.policies, on, policy.id),
  })
}

/** The most recent applicant details on this device, used to prefill a new quote. */
export function savedApplicant(state: AppState): Applicant | undefined {
  return state.quotes[0]?.input.applicant ?? state.policies[0]?.holder
}
