import type { Product, ProductId } from './types'

/**
 * The product catalogue of the Advantage platform. Every product is rated with
 * the same generic engine (see `rating.ts`); only the factors below differ.
 */
export const products: Product[] = [
  {
    id: 'auto',
    name: 'Motor insurance',
    tagline: 'Comprehensive cover for your car',
    description:
      'Protects your vehicle against accident, fire and theft, and covers your liability towards other road users.',
    benefits: [
      'Accidental damage, fire and theft',
      'Third party injury and property damage',
      '24/7 accident recovery helpline',
    ],
    basePremium: 240,
    ratePerThousand: 18,
    minimumPremium: 180,
    sumInsured: {
      min: 2000,
      max: 150000,
      step: 1000,
      default: 20000,
      label: 'Vehicle value',
    },
    ageBands: [
      { maxAge: 24, multiplier: 1.65 },
      { maxAge: 29, multiplier: 1.25 },
      { maxAge: 59, multiplier: 1 },
      { maxAge: 74, multiplier: 1.12 },
      { maxAge: 200, multiplier: 1.4 },
    ],
    riskFactors: [
      {
        id: 'usage',
        label: 'How is the vehicle used?',
        help: 'Business mileage carries a higher exposure than social use.',
        options: [
          { value: 'social', label: 'Social and domestic', multiplier: 1 },
          { value: 'commuting', label: 'Commuting', multiplier: 1.1 },
          { value: 'business', label: 'Business use', multiplier: 1.28 },
        ],
      },
      {
        id: 'claims',
        label: 'Claims in the last 5 years',
        help: 'A clean claims history attracts a lower premium.',
        options: [
          { value: 'none', label: 'No claims', multiplier: 0.9 },
          { value: 'one', label: 'One claim', multiplier: 1.15 },
          { value: 'multiple', label: 'Two or more claims', multiplier: 1.5 },
        ],
      },
      {
        id: 'parking',
        label: 'Overnight parking',
        help: 'Where the vehicle is kept between 10pm and 6am.',
        options: [
          { value: 'garage', label: 'Locked garage', multiplier: 0.92 },
          { value: 'driveway', label: 'Private driveway', multiplier: 1 },
          { value: 'street', label: 'On the street', multiplier: 1.14 },
        ],
      },
    ],
    coverages: [
      {
        id: 'breakdown',
        name: 'Breakdown assistance',
        description: 'Roadside repair and recovery anywhere in the country.',
        rate: 0.08,
      },
      {
        id: 'courtesy-car',
        name: 'Courtesy car',
        description: 'A replacement vehicle while yours is being repaired.',
        rate: 0.06,
      },
      {
        id: 'legal',
        name: 'Motor legal protection',
        description: 'Legal costs when recovering uninsured losses.',
        rate: 0.04,
      },
    ],
    excessOptions: [
      { value: 250, multiplier: 1.12 },
      { value: 500, multiplier: 1 },
      { value: 1000, multiplier: 0.9 },
      { value: 2000, multiplier: 0.82 },
    ],
  },
  {
    id: 'home',
    name: 'Home insurance',
    tagline: 'Buildings and contents, one policy',
    description:
      'Covers the structure of your home and the belongings inside it against fire, flood, escape of water and theft.',
    benefits: [
      'Buildings and contents cover',
      'Alternative accommodation after a major loss',
      'Emergency home assistance',
    ],
    basePremium: 160,
    ratePerThousand: 3.2,
    minimumPremium: 120,
    sumInsured: {
      min: 20000,
      max: 1000000,
      step: 5000,
      default: 250000,
      label: 'Rebuild and contents value',
    },
    ageBands: [
      { maxAge: 24, multiplier: 1.15 },
      { maxAge: 64, multiplier: 1 },
      { maxAge: 200, multiplier: 0.95 },
    ],
    riskFactors: [
      {
        id: 'propertyType',
        label: 'Property type',
        help: 'Detached properties cost more to rebuild.',
        options: [
          { value: 'apartment', label: 'Apartment', multiplier: 0.88 },
          { value: 'terraced', label: 'Terraced house', multiplier: 1 },
          { value: 'detached', label: 'Detached house', multiplier: 1.18 },
        ],
      },
      {
        id: 'security',
        label: 'Security measures',
        help: 'Alarms and approved locks reduce the risk of theft.',
        options: [
          { value: 'alarm', label: 'Monitored alarm and approved locks', multiplier: 0.9 },
          { value: 'locks', label: 'Approved locks only', multiplier: 1 },
          { value: 'none', label: 'No additional security', multiplier: 1.16 },
        ],
      },
      {
        id: 'floodRisk',
        label: 'Flood risk area',
        help: 'Based on the environmental flood map for your postcode.',
        options: [
          { value: 'low', label: 'Low risk', multiplier: 1 },
          { value: 'medium', label: 'Medium risk', multiplier: 1.22 },
          { value: 'high', label: 'High risk', multiplier: 1.6 },
        ],
      },
    ],
    coverages: [
      {
        id: 'accidental',
        name: 'Accidental damage',
        description: 'Spills, breakages and DIY mishaps inside the home.',
        rate: 0.1,
      },
      {
        id: 'away-from-home',
        name: 'Personal possessions away from home',
        description: 'Cover for phones, jewellery and bikes outside the property.',
        rate: 0.07,
      },
      {
        id: 'home-emergency',
        name: 'Home emergency',
        description: 'Call-out and labour for boiler, plumbing and electrical failures.',
        rate: 0.05,
      },
    ],
    excessOptions: [
      { value: 150, multiplier: 1.1 },
      { value: 300, multiplier: 1 },
      { value: 600, multiplier: 0.92 },
      { value: 1000, multiplier: 0.85 },
    ],
  },
  {
    id: 'life',
    name: 'Life insurance',
    tagline: 'Financial security for the people you love',
    description:
      'Pays a lump sum to your beneficiaries if you die during the term of the policy.',
    benefits: [
      'Level lump sum benefit',
      'Terminal illness cover included',
      'Premiums fixed for the policy term',
    ],
    basePremium: 90,
    ratePerThousand: 1.4,
    minimumPremium: 96,
    sumInsured: {
      min: 25000,
      max: 2000000,
      step: 25000,
      default: 200000,
      label: 'Benefit amount',
    },
    ageBands: [
      { maxAge: 29, multiplier: 0.75 },
      { maxAge: 39, multiplier: 1 },
      { maxAge: 49, multiplier: 1.45 },
      { maxAge: 59, multiplier: 2.1 },
      { maxAge: 200, multiplier: 3.2 },
    ],
    riskFactors: [
      {
        id: 'smoker',
        label: 'Do you smoke?',
        help: 'Includes e-cigarettes and nicotine replacement within the last 12 months.',
        options: [
          { value: 'no', label: 'Non-smoker', multiplier: 1 },
          { value: 'yes', label: 'Smoker', multiplier: 1.75 },
        ],
      },
      {
        id: 'occupation',
        label: 'Occupation risk',
        help: 'Manual and hazardous occupations carry a loading.',
        options: [
          { value: 'office', label: 'Office based', multiplier: 1 },
          { value: 'manual', label: 'Manual work', multiplier: 1.2 },
          { value: 'hazardous', label: 'Hazardous work', multiplier: 1.55 },
        ],
      },
    ],
    coverages: [
      {
        id: 'critical-illness',
        name: 'Critical illness cover',
        description: 'Pays out on diagnosis of a specified critical illness.',
        rate: 0.35,
      },
      {
        id: 'waiver',
        name: 'Waiver of premium',
        description: 'Premiums are paid for you if you cannot work through illness.',
        rate: 0.06,
      },
    ],
    excessOptions: [{ value: 0, multiplier: 1 }],
  },
  {
    id: 'travel',
    name: 'Travel insurance',
    tagline: 'Cover from the moment you book',
    description:
      'Medical expenses, cancellation and baggage protection for single trips or a full year of travel.',
    benefits: [
      'Emergency medical expenses and repatriation',
      'Cancellation and curtailment',
      'Baggage and personal money',
    ],
    basePremium: 45,
    ratePerThousand: 6,
    minimumPremium: 28,
    sumInsured: {
      min: 500,
      max: 25000,
      step: 500,
      default: 5000,
      label: 'Trip value',
    },
    ageBands: [
      { maxAge: 17, multiplier: 0.6 },
      { maxAge: 64, multiplier: 1 },
      { maxAge: 74, multiplier: 1.8 },
      { maxAge: 200, multiplier: 2.6 },
    ],
    riskFactors: [
      {
        id: 'destination',
        label: 'Destination',
        help: 'Medical costs vary significantly by region.',
        options: [
          { value: 'domestic', label: 'Domestic', multiplier: 0.7 },
          { value: 'europe', label: 'Europe', multiplier: 1 },
          { value: 'worldwide', label: 'Worldwide', multiplier: 1.6 },
        ],
      },
      {
        id: 'tripType',
        label: 'Trip type',
        help: 'Annual multi-trip cover protects every journey in the next 12 months.',
        options: [
          { value: 'single', label: 'Single trip', multiplier: 1 },
          { value: 'annual', label: 'Annual multi-trip', multiplier: 2.2 },
        ],
      },
    ],
    coverages: [
      {
        id: 'winter-sports',
        name: 'Winter sports',
        description: 'Skiing, snowboarding and piste closure cover.',
        rate: 0.22,
      },
      {
        id: 'gadget',
        name: 'Gadget cover',
        description: 'Laptops, phones and cameras taken on your trip.',
        rate: 0.12,
      },
      {
        id: 'cruise',
        name: 'Cruise cover',
        description: 'Missed port departures and cabin confinement.',
        rate: 0.15,
      },
    ],
    excessOptions: [
      { value: 0, multiplier: 1.15 },
      { value: 75, multiplier: 1 },
      { value: 150, multiplier: 0.94 },
    ],
  },
]

export function getProduct(productId: ProductId): Product {
  const product = products.find((candidate) => candidate.id === productId)
  if (!product) {
    throw new Error(`Unknown product: ${productId}`)
  }
  return product
}

export function findProduct(productId: string): Product | undefined {
  return products.find((candidate) => candidate.id === productId)
}
