import type { WaterUtilityProvider, WaterFetchResult, WaterUsageHour } from './provider'

// ── SAWS Portal Config ────────────────────────────────────────────────────────
// OPERATOR: Verify every value below by inspecting the live SAWS portal.
// Steps:
//   1. Open Chrome → DevTools → Network tab
//   2. Go to the SAWS login page, log in with a customer account
//   3. Navigate to the usage/MyUse page
//   4. Look for a POST request containing "LoadConsumptionChartData"
//   5. Copy the full Request URL → set as CONSUMPTION_ENDPOINT_URL
//   6. Copy the form payload fields (meterId, moveInDate) — used for data requests
//   7. Inspect the login form HTML for the correct input selectors
const LOGIN_URL = 'https://myaccount.saws.org/Login.aspx'
const USERNAME_SELECTOR = '#ContentPlaceHolder1_txtUserName'
const PASSWORD_SELECTOR = '#ContentPlaceHolder1_txtPwd'
const SUBMIT_SELECTOR = '#ContentPlaceHolder1_btnSubmit'
const USAGE_URL = 'https://myaccount.saws.org/MyAccount/MyUsageH2OC.aspx'         // TODO: verify — may be /MyUsage.aspx
const CONSUMPTION_ENDPOINT_FRAGMENT = 'LoadConsumptionChartData'
const CONSUMPTION_ENDPOINT_URL = 'https://myaccount.saws.org/MyAccount/MyUsageH2OC.aspx/LoadConsumptionChartData'  // TODO: verify in Network tab
// ─────────────────────────────────────────────────────────────────────────────

// The SAWS response wraps JSON inside a "d" property as a stringified string.
// After body.d is JSON.parse'd, the shape is { data: [{ category, hourly: [...] }] }
function parseSawsDate(category: string, startDateStr: string): string {
  const [month, day] = category.split('/').map(Number)
  // Year is taken from the start date — works correctly within a single calendar year.
  // Edge case: year-boundary ranges (Dec→Jan) are not handled; document as known limitation.
  const year = parseInt(startDateStr.split('/')[2])
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function flattenHourly(days: Record<string, unknown>[], startDate: string): WaterUsageHour[] {
  const hours: WaterUsageHour[] = []
  for (const day of days) {
    const date = parseSawsDate(String(day.category), startDate)
    const hourly = (day.hourly ?? []) as Record<string, unknown>[]
    for (let h = 0; h < hourly.length; h++) {
      hours.push({ date, hour: h, gallons: Number(hourly[h].usage ?? 0) })
    }
  }
  return hours
}

export class SawsProvider implements WaterUtilityProvider {
  providerKey = 'SAWS'

  async fetchUsage({ username, password, meterId, moveInDate, startDate, endDate }: {
    username: string
    password: string
    meterId?: string
    moveInDate?: string
    startDate: string
    endDate: string
  }): Promise<WaterFetchResult> {
    // Dynamic import keeps playwright out of the bundle on environments that don't have it.
    // Requires: npm install playwright && npx playwright install chromium
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const context = await browser.newContext()
    const page = await context.newPage()

    let capturedMeterId: string | undefined
    let capturedMoveInDate: string | undefined
    let capturedEndpointUrl: string | undefined
    let hours: WaterUsageHour[] = []

    try {
      // Step 1: Login via UI (always required to establish authenticated session)
      await page.goto(LOGIN_URL)
      await page.fill(USERNAME_SELECTOR, username)
      await page.fill(PASSWORD_SELECTOR, password)
      // Password is never logged — only filled into the browser form field
      await page.click(SUBMIT_SELECTOR)
      await page.waitForLoadState('networkidle')

      // Always navigate to the usage page — this establishes full page-level session
      // context that ASP.NET requires before accepting AJAX/PageMethod calls.
      // If meterId is unknown we also intercept the automatic data request to capture it.
      if (!meterId || !moveInDate) {
        let resolveCapture: () => void
        const capturePromise = new Promise<void>(res => { resolveCapture = res })

        // Intercept outgoing POST to capture meterId and moveInDate from the page's own request
        page.on('request', req => {
          if (req.url().includes(CONSUMPTION_ENDPOINT_FRAGMENT) && req.method() === 'POST') {
            try {
              const raw = req.postData() ?? ''
              // PageMethod sends JSON body: {"meterId":"...","moveInDate":"..."}
              // Try JSON first, fall back to form-encoded
              try {
                const json = JSON.parse(raw)
                capturedMeterId = json.meterId ?? undefined
                capturedMoveInDate = json.moveInDate ?? undefined
              } catch {
                const params = new URLSearchParams(raw)
                capturedMeterId = params.get('meterId') ?? undefined
                capturedMoveInDate = params.get('moveInDate') ?? undefined
              }
              capturedEndpointUrl = req.url()
              resolveCapture()
            } catch {}
          }
        })

        const responsePromise = page.waitForResponse(
          res => res.url().includes(CONSUMPTION_ENDPOINT_FRAGMENT),
          { timeout: 30_000 }
        )

        await page.goto(USAGE_URL)
        await page.waitForLoadState('networkidle')

        try {
          const [response] = await Promise.all([responsePromise, capturePromise])
          const body = await response.json()
          const inner = JSON.parse(body.d)
          hours = flattenHourly(inner.data ?? [], startDate)
        } catch (err) {
          console.error('[SAWS] Auto-capture from usage page failed:', err instanceof Error ? err.message : err)
        }

        if (!capturedMeterId) {
          throw new Error(
            'Could not auto-capture meterId from SAWS portal. ' +
            'Please inspect the SAWS portal manually, find the LoadConsumptionChartData POST, ' +
            'and enter the meterId manually in the Water Customers dashboard.'
          )
        }
      } else {
        // meterId is known — still navigate to usage page to establish page session context
        await page.goto(USAGE_URL)
        await page.waitForLoadState('networkidle')
      }

      // Direct POST replay for the requested date range.
      // ASP.NET PageMethods require JSON body + specific Content-Type and Referer headers.
      if (hours.length === 0) {
        const endpointUrl = capturedEndpointUrl ?? CONSUMPTION_ENDPOINT_URL
        const resolvedMeterId = meterId ?? capturedMeterId ?? ''
        const resolvedMoveInDate = moveInDate ?? capturedMoveInDate ?? ''

        const response = await context.request.post(endpointUrl, {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Referer': USAGE_URL,
            'X-Requested-With': 'XMLHttpRequest',
          },
          data: JSON.stringify({
            start: startDate,
            end: endDate,
            group: '3',
            meterId: resolvedMeterId,
            moveInDate: resolvedMoveInDate,
            moveOutDate: '',
          }),
        })

        const body = await response.json()
        const inner = JSON.parse(body.d)
        hours = flattenHourly(inner.data ?? [], startDate)
      }

      return { hours, capturedMeterId, capturedMoveInDate }
    } finally {
      await browser.close()
    }
  }
}
