import { expect, test, type Page } from '@playwright/test'

const today = new Date().toISOString().slice(0, 10)

/**
 * Full-page screenshot for the README. Once a test has scrolled, a full-page
 * capture draws the sticky header part of the way down the page, so the header
 * is made static while the screenshot is taken.
 */
async function captureFullPage(page: Page, name: string) {
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: true,
    style: '.site-header { position: static !important; }',
  })
}

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

  test('the admin portal sets the platform up', async ({ page }) => {
    await page.goto('/#/admin')

    await expect(page.getByRole('heading', { name: 'Admin portal' })).toBeVisible()
    await page.getByLabel('Platform name').fill('Northwind Cover')
    await page.getByLabel('Insurance premium tax (%)').fill('20')
    await page.getByRole('checkbox', { name: /Travel insurance/ }).uncheck()
    await page.getByRole('button', { name: 'Save settings' }).click()

    await expect(page.getByRole('status')).toContainText('Settings saved')
    await expect(page.locator('.site-header')).toContainText('Northwind Cover')
    await page.screenshot({ path: 'docs/screenshots/07-admin.png', fullPage: true })

    await page.goto('/#/quote')
    await expect(page.getByRole('heading', { name: 'Motor insurance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Travel insurance' })).toHaveCount(0)

    await page.goto('/#/quote/travel')
    await expect(page.getByRole('alert')).toContainText('is not on sale at the moment')
  })

  test('integrations verify the postcode and convert the price', async ({ page }) => {
    // The external services are stubbed so the journey is deterministic offline.
    await page.route('**/api.postcodes.io/postcodes/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          result: {
            postcode: 'SW1A 2AA',
            country: 'England',
            region: 'London',
            admin_district: 'Westminster',
            latitude: 51.50354,
            longitude: -0.127695,
          },
        }),
      }),
    )
    await page.route('**/api.frankfurter.app/latest**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ base: 'GBP', date: '2026-09-14', rates: { EUR: 1.2 } }),
      }),
    )

    await page.goto('/#/quote/auto')
    await page.getByLabel('Postcode').fill('sw1a 2aa')
    await page.getByRole('button', { name: 'Check postcode' }).click()
    await expect(page.getByTestId('address-result')).toContainText('Westminster')
    await expect(page.getByLabel('Postcode')).toHaveValue('SW1A 2AA')

    await buyMotorPolicy(page)
    await page.getByLabel('Show this price in another currency').selectOption('EUR')
    await page.getByRole('button', { name: 'Convert' }).click()
    await expect(page.getByTestId('converted-premium')).toContainText('European Central Bank')
    await page.screenshot({ path: 'docs/screenshots/08-integrations.png', fullPage: true })

    await page.goto('/#/admin')
    await page.getByRole('button', { name: 'Test connection' }).first().click()
    await expect(page.getByTestId('check-addressLookup')).toContainText('Connected')
    await page.screenshot({ path: 'docs/screenshots/09-admin-integrations.png', fullPage: true })
  })

  test('cover survives a page reload', async ({ page }) => {
    await buyMotorPolicy(page)

    await page.goto('/#/policies')
    await page.reload()

    await expect(page.getByText('ADV-AUTO-000001')).toBeVisible()
  })

  test('a policy schedule can be viewed and printed', async ({ page }) => {
    await buyMotorPolicy(page)

    await page.goto('/#/policies')
    await page.getByRole('button', { name: 'Policy schedule' }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Policy schedule')
    await expect(page).toHaveTitle('Policy schedule ADV-AUTO-000001 — Advantage')
    await expect(page.getByText('Alex Turner')).toBeVisible()
    await captureFullPage(page, '10-policy-schedule')

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('.site-header')).toBeHidden()
    await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden()
  })

  test('a policy is renewed at the price for the new period of cover', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-15T10:00:00Z'))
    await buyMotorPolicy(page)

    // Eleven months later renewal is open, and the premium tax has gone up.
    await page.clock.setFixedTime(new Date('2026-12-20T10:00:00Z'))
    await page.goto('/#/admin')
    await page.getByLabel('Insurance premium tax (%)').fill('20')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByRole('status')).toContainText('Settings saved')

    await page.goto('/#/policies')
    await page.getByRole('button', { name: 'Renew', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Confirm renewal' })).toContainText(
      'Your new cover starts on 15 Jan 2027.',
    )
    await expect(page.getByTestId('renewal-price')).toContainText('up from')
    await captureFullPage(page, '11-renewal')

    await page.getByRole('button', { name: 'Confirm renewal' }).click()
    await expect(page.getByRole('status')).toHaveText(
      'Renewed. Your cover now runs until 15 Jan 2028.',
    )
  })

  test('a cancelled policy refunds the unused cover', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-01-15T10:00:00Z'))
    await buyMotorPolicy(page)

    await page.clock.setFixedTime(new Date('2026-07-16T10:00:00Z'))
    await page.goto('/#/policies')
    await page.getByRole('button', { name: 'Cancel policy' }).click()
    await expect(page.getByRole('group', { name: 'Confirm cancellation' })).toContainText(
      /You will be refunded £[\d,]+\.\d{2} for the unused part of your cover\./,
    )
    await captureFullPage(page, '12-cancellation')

    await page.getByRole('button', { name: 'Yes, cancel' }).click()
    await expect(page.getByRole('status')).toContainText(/A refund of £[\d,]+\.\d{2} will be paid/)
    await expect(page.locator('.badge--cancelled')).toBeVisible()
    await expect(page.getByText('Cancelled on')).toBeVisible()
  })

  test('claims share the sum insured and can be filtered and annotated', async ({ page }) => {
    await buyMotorPolicy(page)
    await page.getByRole('link', { name: 'Claims' }).click()

    await page.getByLabel('Policy', { exact: true }).selectOption('ADV-AUTO-000001')
    await expect(page.getByText('You can claim up to £25,000.00 in this period of cover.')).toBeVisible()

    async function submitClaim(description: string, amount: string) {
      await page.getByLabel('Date of the incident').fill(today)
      await page.getByLabel('What happened?').fill(description)
      await page.getByLabel('Amount claimed').fill(amount)
      await page.getByRole('button', { name: 'Submit claim' }).click()
    }
    await submitClaim('Rear ended at a set of traffic lights on the ring road, no injuries.', '2400')
    await expect(page.getByText('Claim CLM-000001 submitted.')).toBeVisible()
    await submitClaim('Wing mirror and door panel damaged by a passing van while parked.', '1600')
    await expect(page.getByText('Claim CLM-000002 submitted.')).toBeVisible()

    const first = page.locator('article', { hasText: 'CLM-000001' })
    const second = page.locator('article', { hasText: 'CLM-000002' })
    await first.getByRole('button', { name: 'Mark as declined' }).click()
    await second.getByLabel('Handler note (optional)').fill('Photos of the damage received.')
    await second.getByRole('button', { name: 'Mark as in review' }).click()
    await expect(second.getByRole('listitem').last()).toContainText('Photos of the damage received.')

    // The declined claim no longer counts against the sum insured.
    await expect(page.getByText('You can claim up to £23,400.00 in this period of cover.')).toBeVisible()

    await page.getByLabel('Filter by status').selectOption('open')
    await expect(first).toBeHidden()
    await expect(second).toBeVisible()
    await captureFullPage(page, '13-claims-filter')
  })

  test('data can be backed up and restored', async ({ page }, testInfo) => {
    await buyMotorPolicy(page)
    await page.goto('/#/admin')

    const downloadStarted = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download a backup' }).click()
    const download = await downloadStarted
    expect(download.suggestedFilename()).toMatch(/^advantage-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const backupPath = testInfo.outputPath('backup.json')
    await download.saveAs(backupPath)

    await page.getByRole('button', { name: 'Clear all data' }).click()
    await page.getByRole('button', { name: 'Yes, clear all data' }).click()
    await page.goto('/#/policies')
    await expect(page.getByText('You do not have any policies yet.')).toBeVisible()

    await page.goto('/#/admin')
    await page.getByLabel('Restore from a backup file').setInputFiles(backupPath)
    const confirm = page.getByRole('group', { name: 'Confirm restore' })
    await expect(confirm).toContainText('contains 1 quote, 1 policy and 0 claims.')
    await page
      .locator('section.section', { has: page.getByRole('heading', { name: 'Data', exact: true }) })
      .screenshot({ path: 'docs/screenshots/14-backup-restore.png' })

    await confirm.getByRole('button', { name: 'Restore this backup' }).click()
    await expect(page.getByRole('status')).toContainText('Backup restored.')

    await page.goto('/#/policies')
    await expect(page.getByText('ADV-AUTO-000001')).toBeVisible()
  })

  test('changes made in one tab appear in the others', async ({ page, context }) => {
    const otherTab = await context.newPage()
    await otherTab.goto('/#/policies')
    await expect(otherTab.getByText('You do not have any policies yet.')).toBeVisible()

    await buyMotorPolicy(page)

    await expect(otherTab.getByText('ADV-AUTO-000001')).toBeVisible()
  })

  test('returning customers have their details filled in', async ({ page }) => {
    await buyMotorPolicy(page)

    await page.goto('/#/quote/home')

    await expect(page.getByText('We have filled in your details from your last quote.')).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue('Alex Turner')
    await captureFullPage(page, '15-quote-prefill')
  })
})
