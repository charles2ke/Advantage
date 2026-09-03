import { expect, test, type Page } from '@playwright/test'

const today = new Date().toISOString().slice(0, 10)

async function buyMotorPolicy(page: Page) {
  await page.goto('/#/quote/auto')

  await page.getByLabel('Full name').fill('Alex Turner')
  await page.getByLabel('Email address').fill('alex@example.com')
  await page.getByLabel('Date of birth').fill('1986-01-01')
  await page.getByLabel('Postcode').fill('M1 2AB')
  await page.getByRole('button', { name: 'Continue to cover' }).click()

  await page.getByLabel('Vehicle value').fill('25000')
  await page.getByLabel('Excess').selectOption('1000')
  await page.getByLabel('How is the vehicle used?').selectOption('commuting')
  await page.getByLabel('Claims in the last 5 years').selectOption('none')
  await page.getByLabel('Overnight parking').selectOption('garage')
  await page.getByRole('checkbox', { name: /Breakdown assistance/ }).check()
  await page.getByRole('button', { name: 'See my price' }).click()

  await expect(page.getByRole('heading', { name: 'Your quote is ready' })).toBeVisible()
  await page.getByRole('button', { name: 'Buy this policy' }).click()
  await expect(page.getByText(/is now active/)).toBeVisible()
}

test.describe('Advantage insurance platform', () => {
  test('homepage presents the product catalogue', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Insurance that works the way you do',
    )
    await expect(page.getByRole('heading', { name: 'Motor insurance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Home insurance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Life insurance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Travel insurance' })).toBeVisible()

    await page.screenshot({ path: 'docs/screenshots/01-home.png', fullPage: true })
  })

  test('quote journey prices cover and issues a policy', async ({ page }) => {
    await page.goto('/#/quote/auto')
    await page.screenshot({ path: 'docs/screenshots/02-quote-details.png', fullPage: true })

    await page.getByRole('button', { name: 'Continue to cover' }).click()
    await expect(page.getByRole('alert')).toContainText('Enter a valid email address.')

    await buyMotorPolicy(page)
    await page.screenshot({ path: 'docs/screenshots/03-quote-result.png', fullPage: true })

    await page.getByRole('link', { name: /Policies/ }).click()
    await expect(page.getByText('ADV-AUTO-000001')).toBeVisible()
    await page.getByRole('button', { name: 'View details' }).click()
    await page.screenshot({ path: 'docs/screenshots/04-policies.png', fullPage: true })
  })

  test('premium responds to the answers given', async ({ page }) => {
    await page.goto('/#/quote/home')

    await page.getByLabel('Full name').fill('Priya Shah')
    await page.getByLabel('Email address').fill('priya@example.com')
    await page.getByLabel('Date of birth').fill('1980-06-15')
    await page.getByLabel('Postcode').fill('BS1 4ST')
    await page.getByRole('button', { name: 'Continue to cover' }).click()

    const price = page.getByTestId('live-premium')
    const before = await price.textContent()

    await page.getByLabel('Flood risk area').selectOption('high')
    await expect(price).not.toHaveText(before ?? '')
  })

  test('a claim can be submitted and tracked through to settlement', async ({ page }) => {
    await buyMotorPolicy(page)

    await page.getByRole('link', { name: 'Claims' }).click()
    await page.getByLabel('Policy', { exact: true }).selectOption('ADV-AUTO-000001')
    await page.getByLabel('Date of the incident').fill(today)
    await page
      .getByLabel('What happened?')
      .fill('Rear ended at a set of traffic lights on the ring road, no injuries.')
    await page.getByLabel('Amount claimed').fill('2400')
    await page.getByRole('button', { name: 'Submit claim' }).click()

    await expect(page.getByText('Claim CLM-000001 submitted.')).toBeVisible()
    await page.screenshot({ path: 'docs/screenshots/05-claim-submitted.png', fullPage: true })

    await page.getByRole('button', { name: 'Mark as in review' }).click()
    await page.getByRole('button', { name: 'Mark as approved' }).click()
    await page.getByRole('button', { name: 'Mark as settled' }).click()

    await expect(page.locator('.badge--settled')).toBeVisible()
    await expect(page.getByText('Settlement has been paid to the policyholder.')).toBeVisible()
    await page.screenshot({ path: 'docs/screenshots/06-claim-settled.png', fullPage: true })
  })

  test('cover survives a page reload', async ({ page }) => {
    await buyMotorPolicy(page)

    await page.goto('/#/policies')
    await page.reload()

    await expect(page.getByText('ADV-AUTO-000001')).toBeVisible()
  })
})
