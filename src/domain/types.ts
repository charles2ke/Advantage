export type ProductId = 'auto' | 'home' | 'life' | 'travel'

export interface RiskFactorOption {
  value: string
  label: string
  /** Multiplier applied to the base premium. 1 means no impact. */
  multiplier: number
}

export interface RiskFactorDefinition {
  id: string
  label: string
  help: string
  options: RiskFactorOption[]
}

export interface CoverageOption {
  id: string
  name: string
  description: string
  /** Fraction of the risk-adjusted premium added when the coverage is selected. */
  rate: number
}

export interface ExcessOption {
  value: number
  /** Multiplier applied when this excess (deductible) is chosen. */
  multiplier: number
}

export interface AgeBand {
  /** Upper bound of the band, inclusive. */
  maxAge: number
  multiplier: number
}

export interface Product {
  id: ProductId
  name: string
  tagline: string
  description: string
  benefits: string[]
  /** Flat premium component in currency units. */
  basePremium: number
  /** Premium added per 1,000 units of sum insured. */
  ratePerThousand: number
  minimumPremium: number
  sumInsured: {
    min: number
    max: number
    step: number
    default: number
    label: string
  }
  ageBands: AgeBand[]
  riskFactors: RiskFactorDefinition[]
  coverages: CoverageOption[]
  excessOptions: ExcessOption[]
}

export interface Applicant {
  fullName: string
  email: string
  dateOfBirth: string
  postcode: string
}

export interface QuoteInput {
  productId: ProductId
  applicant: Applicant
  sumInsured: number
  excess: number
  coverageIds: string[]
  /** Answers to the product risk questions, keyed by risk factor id. */
  riskAnswers: Record<string, string>
  /** Number of policies the customer already holds, used for the loyalty discount. */
  existingPolicies: number
}

export interface PremiumBreakdown {
  base: number
  riskAdjustment: number
  coverageAdditions: number
  excessAdjustment: number
  loyaltyDiscount: number
  netPremium: number
  tax: number
  total: number
  monthly: number
}

export interface Quote {
  id: string
  reference: string
  productId: ProductId
  createdAt: string
  expiresAt: string
  input: QuoteInput
  premium: PremiumBreakdown
}

export type PolicyStatus = 'active' | 'lapsed' | 'cancelled'

export interface Policy {
  id: string
  policyNumber: string
  productId: ProductId
  status: PolicyStatus
  holder: Applicant
  sumInsured: number
  excess: number
  coverageIds: string[]
  premium: PremiumBreakdown
  startDate: string
  endDate: string
  quoteReference: string
}

export type ClaimStatus = 'submitted' | 'in_review' | 'approved' | 'declined' | 'settled'

export interface ClaimEvent {
  status: ClaimStatus
  note: string
  at: string
}

export interface Claim {
  id: string
  reference: string
  policyNumber: string
  productId: ProductId
  incidentDate: string
  description: string
  amountClaimed: number
  status: ClaimStatus
  createdAt: string
  timeline: ClaimEvent[]
}
